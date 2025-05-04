// popup-injector.js
(function () {
  // Check if the popup already exists
  if (document.getElementById("chiron-popup")) {
    // Remove existing popup
    const existingPopup = document.getElementById("chiron-popup");
    const existingStyles = document.getElementById("chiron-popup-styles");
    if (existingPopup) existingPopup.remove();
    if (existingStyles) existingStyles.remove();
    return;
  }

  // Layout containing styles and HTML template for the popup
  const layout = {
    styles: `
            @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
            
            .chiron-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 380px;
                background: linear-gradient(135deg, rgba(116, 185, 255, 0.95) 0%, rgba(162, 155, 254, 0.95) 50%, rgba(253, 121, 168, 0.95) 100%);
                border-radius: 25px;
                box-shadow: 0 8px 32px rgba(31, 38, 135, 0.25);
                border: 2px solid rgba(255, 255, 255, 0.5);
                backdrop-filter: blur(10px);
                z-index: 2147483647;
                font-family: 'Nunito', sans-serif;
                color: #2d3436;
                animation: chiron-slideIn 0.3s ease-out;
                overflow: hidden;
            }
            
            @keyframes chiron-slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes chiron-slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .chiron-popup.closing {
                animation: chiron-slideOut 0.3s ease-in;
            }
            
            .chiron-popup .container {
                padding: 1.5rem;
                min-height: 280px;
                animation: chiron-float 6s ease-in-out infinite;
            }
            
            @keyframes chiron-float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
            
            .chiron-popup h1 {
                margin: 0 0 1.5rem;
                font-size: 2rem;
                text-align: center;
                color: #ffffff;
                font-weight: 800;
                letter-spacing: 1px;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
                position: relative;
            }
            
            .chiron-popup h1::after {
                content: '✨';
                position: absolute;
                right: -5px;
                top: -5px;
                font-size: 1.2rem;
                animation: chiron-sparkle 2s infinite;
            }
            
            @keyframes chiron-sparkle {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
            }
            
            .chiron-popup .form-group {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 0.9rem;
            }
            
            .chiron-popup input[type="text"] {
                flex: 1;
                padding: 0.875rem 1.25rem;
                font-size: 1.1rem;
                border: 2px solid rgba(255, 255, 255, 0.6);
                border-radius: 15px;
                background-color: rgba(255, 255, 255, 0.9);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: inherit;
                color: #2d3436;
            }
            
            .chiron-popup input[type="text"]:focus {
                outline: none;
                border-color: #ffffff;
                box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.3), 0 6px 12px rgba(0, 0, 0, 0.15);
                transform: translateY(-2px);
            }
            
            .chiron-popup input[type="text"]::placeholder {
                color: #6c5ce7;
                opacity: 0.8;
            }
            
            .chiron-popup button {
                padding: 0.875rem 1.5rem;
                font-size: 1.1rem;
                border: none;
                border-radius: 15px;
                cursor: pointer;
                font-weight: 700;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                font-family: inherit;
                position: relative;
                overflow: hidden;
            }
            
            .chiron-popup button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                transition: 0.5s;
            }
            
            .chiron-popup button:hover::before {
                left: 100%;
            }
            
            .chiron-popup #start {
                background: linear-gradient(45deg, #55efc4, #00b894);
                color: #fff;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .chiron-popup #start:disabled {
                background: linear-gradient(45deg, #b2bec3, #95a5a6);
                cursor: not-allowed;
                opacity: 0.8;
                box-shadow: none;
            }
            
            .chiron-popup #start:not(:disabled):hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 6px 12px rgba(0, 184, 148, 0.3);
            }
            
            .chiron-popup .button-group {
                display: flex;
                justify-content: center;
            }
            
            .chiron-popup #stop {
                background: linear-gradient(45deg, #ff7675, #d63031);
                color: #fff;
                width: 100%;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .chiron-popup #stop:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 6px 12px rgba(214, 48, 49, 0.3);
            }
            
            .chiron-popup .status {
                margin-top: 1.2rem;
                font-size: 1.1rem;
                color: #ffffff;
                text-align: center;
                min-height: 3em;
                padding: 0.75rem;
                border-radius: 12px;
                background-color: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                font-family: inherit;
                font-weight: 500;
                letter-spacing: 0.3px;
                line-height: 1.5;
                border: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: inset 0 1px 3px rgba(255, 255, 255, 0.2);
            }
            
            .chiron-popup .footer {
                margin-top: 1.5rem;
                font-size: 1rem;
                color: #ffffff;
                text-align: center;
                opacity: 0.95;
                max-width: 320px;
                margin-left: auto;
                margin-right: auto;
                line-height: 1.5;
                font-weight: 500;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .chiron-popup .footer::before {
                content: '🌟';
                margin-right: 8px;
                font-size: 1.2rem;
            }
            
            .chiron-popup .footer::after {
                content: '🌟';
                margin-left: 8px;
                font-size: 1.2rem;
            }
            
            .chiron-popup .visually-hidden {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0,0,0,0);
                border: 0;
            }
        `,
    template: `
            <div class="chiron-popup" id="chiron-popup">
                <div class="container">
                    <h1><b>CHIRON</b></h1>
                    <div class="form-group">
                        <label for="userPrompt" class="visually-hidden">Instructions</label>
                        <input
                            type="text"
                            id="userPrompt"
                            placeholder="✍️ What would you like to do?"
                            autocomplete="off"
                        />
                        <button id="start" disabled>🚀 Guide Me</button>
                    </div>
                    <div class="button-group">
                        <button id="stop">🛑 Stop Guide</button>
                    </div>
                    <div id="statusMessage" class="status">
                        Ready to help you navigate! 🌈
                    </div>
                    <div class="footer">
                        <p>Your friendly guide through the library's digital world</p>
                    </div>
                </div>
            </div>
        `,
  };

  // Add styles to the document
  const styleSheet = document.createElement("style");
  styleSheet.id = "chiron-popup-styles";
  styleSheet.textContent = layout.styles;
  document.head.appendChild(styleSheet);

  // Add the popup HTML to the page
  document.body.insertAdjacentHTML("beforeend", layout.template);

  // Get DOM elements
  const popup = document.getElementById("chiron-popup");
  const userPrompt = document.getElementById("userPrompt");
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");
  const statusMessage = document.getElementById("statusMessage");

  // Initialize state
  let isGuiding = false;

  // Update status message
  function updateStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  // Enable/disable start button based on input
  userPrompt.addEventListener("input", function () {
    startBtn.disabled = !this.value.trim();
  });

  // Handle start guide
  startBtn.addEventListener("click", async function () {
    const prompt = userPrompt.value.trim();
    if (!prompt) {
      updateStatus("⚠️ Please enter instructions first");
      return;
    }

    try {
      // Disable buttons and show loading
      startBtn.disabled = true;
      stopBtn.disabled = false;
      userPrompt.disabled = true;
      updateStatus("🔄 Analyzing the page...");
      isGuiding = true;

      // First, set the prompt in the background script
      const setPromptResponse = await chrome.runtime.sendMessage({
        action: "setPrompt",
        prompt: prompt,
      });

      if (!setPromptResponse || !setPromptResponse.success) {
        throw new Error("Failed to set prompt");
      }

      // Now start the guide - send to content script via background script
      const startResponse = await chrome.runtime.sendMessage({
        action: "startGuide",
        prompt: prompt,
      });

      if (!startResponse || !startResponse.success) {
        throw new Error(startResponse?.error || "Failed to start guide");
      }

      // Successfully started - close the popup
      closePopup();
    } catch (error) {
      console.error("❌ Error starting guide:", error);
      updateStatus(`❌ Error: ${error.message}`);
      // Re-enable controls on error
      startBtn.disabled = false;
      stopBtn.disabled = true;
      userPrompt.disabled = false;
      isGuiding = false;
    }
  });

  // Handle stop guide
  stopBtn.addEventListener("click", async function () {
    try {
      // Send message to content script via background script
      const response = await chrome.runtime.sendMessage({
        action: "stopGuide",
      });

      if (!response || !response.success) {
        throw new Error("Failed to stop guide");
      }

      // Reset UI
      isGuiding = false;
      stopBtn.disabled = true;
      startBtn.disabled = !userPrompt.value.trim();
      userPrompt.disabled = false;
      updateStatus("Guide stopped ✋");

      // Close popup after a short delay
      setTimeout(closePopup, 1000);
    } catch (error) {
      console.error("❌ Error stopping guide:", error);
      updateStatus(`❌ Error: ${error.message}`);
    }
  });

  // Handle Enter key in input
  userPrompt.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !startBtn.disabled) {
      startBtn.click();
    }
  });

  // Close popup function
  function closePopup() {
    popup.classList.add("closing");
    setTimeout(() => {
      popup.remove();
      styleSheet.remove();
    }, 300);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "error") {
      updateStatus(`❌ ${message.message}`);
    } else if (message.action === "status") {
      updateStatus(message.message);
    }
  });

  // Handle clicks outside the popup
  document.addEventListener("click", function (e) {
    if (!popup.contains(e.target)) {
      closePopup();
    }
  });

  // Prevent popup from closing when clicking inside it
  popup.addEventListener("click", function (e) {
    e.stopPropagation();
  });
})();
