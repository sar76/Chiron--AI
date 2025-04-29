// popup.js
console.log("🔄 Popup script loaded");

document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ Popup DOM loaded");
  
  const promptInput = document.getElementById('userPrompt');
  const startBtn    = document.getElementById('start');
  const solvedBtn   = document.getElementById('solved');
  const statusElem  = document.getElementById('statusMessage');

  // Listen for error messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    console.log(`📨 Popup received message:`, message);
    
    if (message.action === 'error') {
      statusElem.textContent = message.message;
      statusElem.style.color = 'red';
      startBtn.disabled = false;  // Re-enable the start button
      console.error(`❌ Error: ${message.message}`, message.details ? `Details: ${message.details}` : '');
    }
  });

  // Common start logic (used by Enter key & Start button)
  const startCapture = async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert('Please enter your instructions first.');
      return;
    }
    
    console.log("🔄 Starting capture with prompt:", prompt);
    statusElem.style.color = 'black';  // Reset color
    statusElem.textContent = 'Starting capture...';
    startBtn.disabled = true;  // Disable while processing
    
    try {
      // 1) Store prompt for background.js
      console.log("📤 Sending prompt to background script");
      
      // Use a Promise to handle the asynchronous message passing
      const promptSet = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'setPrompt', prompt }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Error setting prompt:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          if (response && response.success) {
            console.log("✅ Prompt set in background script:", response.prompt);
            resolve(true);
          } else {
            console.error("❌ Failed to set prompt in background script");
            reject(new Error("Failed to set prompt"));
          }
        });
      });
      
      if (!promptSet) {
        throw new Error("Failed to set prompt in background script");
      }
      
      // 2) Tell content.js to begin
      console.log("📤 Sending startCapture to content script");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }
      
      // Use a Promise to handle the asynchronous message passing
      const captureStarted = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'startCapture' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Error starting capture:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          console.log("✅ Capture started in content script");
          resolve(true);
        });
      });
      
      if (!captureStarted) {
        throw new Error("Failed to start capture in content script");
      }
      
      statusElem.textContent = 'Capture started…';
    } catch (error) {
      console.error("❌ Error in startCapture:", error);
      statusElem.textContent = "Error: " + error.message;
      statusElem.style.color = 'red';
      startBtn.disabled = false;
    }
  };

  // Enable Start button only when there's input
  promptInput.addEventListener('input', () => {
    startBtn.disabled = promptInput.value.trim() === '';
  });

  // Enter key still kicks off capture
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startCapture();
  });

  // Start button does the same
  startBtn.addEventListener('click', startCapture);

  // Solved button unchanged
  solvedBtn.addEventListener('click', async () => {
    console.log("🔄 Solved button clicked");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'stopCapture' });
    chrome.runtime.sendMessage({ action: 'clearPrompt' });
    statusElem.textContent = 'Stopped.';
    startBtn.disabled = false;
  });
});
