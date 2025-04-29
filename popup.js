// popup.js
console.log("🔄 Popup script loaded");

document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ Popup DOM loaded");
  
  const promptInput = document.getElementById('userPrompt');
  const startBtn    = document.getElementById('start');
  const stopBtn     = document.getElementById('stop');
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

  // Start the guide process
  const startGuide = async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert('Please enter what you want to do first.');
      return;
    }
    
    console.log("🔄 Starting guide with prompt:", prompt);
    statusElem.style.color = 'black';  // Reset color
    statusElem.textContent = 'Starting guide...';
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
      console.log("📤 Sending startGuide to content script");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }
      
      // Use a Promise to handle the asynchronous message passing
      const guideStarted = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'startGuide', prompt }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Error starting guide:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          console.log("✅ Guide started in content script");
          resolve(true);
        });
      });
      
      if (!guideStarted) {
        throw new Error("Failed to start guide in content script");
      }
      
      statusElem.textContent = 'Guide started. Follow the highlighted elements.';
    } catch (error) {
      console.error("❌ Error in startGuide:", error);
      statusElem.textContent = "Error: " + error.message;
      statusElem.style.color = 'red';
      startBtn.disabled = false;
    }
  };

  // Stop the guide process
  const stopGuide = async () => {
    console.log("🔄 Stopping guide");
    statusElem.textContent = 'Stopping guide...';
    
    try {
      // Send stop message to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error("No active tab found");
      }
      
      await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'stopGuide' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Note: Content script may not be active:", chrome.runtime.lastError);
          }
          resolve();
        });
      });
      
      // Clear prompt in background script
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearPrompt' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Note: Error clearing prompt:", chrome.runtime.lastError);
          }
          resolve();
        });
      });
      
      // Update UI
      statusElem.textContent = 'Guide stopped.';
      startBtn.disabled = false;
    } catch (error) {
      console.error("❌ Error stopping guide:", error);
      statusElem.textContent = "Error: " + error.message;
      statusElem.style.color = 'red';
    }
  };

  // Enable Start button only when there's input
  promptInput.addEventListener('input', () => {
    startBtn.disabled = promptInput.value.trim() === '';
  });

  // Start guide on Enter key
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !startBtn.disabled) {
      startGuide();
    }
  });

  // Start guide on button click
  startBtn.addEventListener('click', startGuide);

  // Stop guide on button click
  stopBtn.addEventListener('click', stopGuide);
});