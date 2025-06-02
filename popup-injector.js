// popup-injector.js
(function () {
  // Track whether we've already shown helpful links & summary
  let helpShown = false;

  if (document.getElementById("chiron-popup")) {
    console.log("⚠️ Chiron popup already present");
    return;
  }

  // ---- 1) Inject VSCode-style CSS ----
  const css = `
  .chiron-popup {
    position: fixed;
    top: 20px;
    left: 20px;        /* 20px in from the left */
    right: 20px;       /* 20px in from the right */
    max-width: 600px;  /* never grow wider than 600px */
    height: 400px;
    display: flex;
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-family: 'Menlo', Consolas, monospace;
    color: #ddd;
    overflow: hidden;
    z-index: 2147483647;
  }

  /* Privacy Policy Overlay */
  .privacy-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    z-index: 2147483649;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .privacy-content {
    background: #1e1e1e;
    padding: 30px;
    border-radius: 8px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    color: #fff;
    font-size: 14px;
    line-height: 1.6;
  }

  .privacy-content h2 {
    color: #0e639c;
    margin-top: 0;
  }

  .privacy-content p {
    margin-bottom: 20px;
  }

  .privacy-accept {
    background: #0e639c;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    margin-top: 20px;
  }

  .privacy-accept:hover {
    background: #1177bb;
  }

  .chiron-popup::before {
    content: "Chiron";
    position: absolute;
    top: 12px;
    left: 20px;
    font-size: 16px;
    font-weight: bold;
    color: #fff;
    pointer-events: none;
  }
  /* Centered "×" close-button */
  #chiron-popup .chiron-close {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;             /* main close button stays at 8px */
    width: 24px !important;
    height: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    border: 1px solid #fff !important;
    border-radius: 4px !important;
    color: #fff !important;
    font-size: 16px !important;
    padding: 0 !important;
    cursor: pointer !important;
    transition: border-color 0.2s, background-color 0.2s !important;
    z-index: 2147483648 !important;
  }

  /* Settings close button - moved left */
  #chiron-popup .settings-close {
    position: absolute !important;
    top: 8px !important;
    right: 32px !important;            /* moved slightly more left to 32px */
    width: 24px !important;
    height: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    border: 1px solid #fff !important;
    border-radius: 4px !important;
    color: #fff !important;
    font-size: 16px !important;
    padding: 0 !important;
    cursor: pointer !important;
    transition: border-color 0.2s, background-color 0.2s !important;
    z-index: 2147483648 !important;
  }

  /* Hover states stay the same */
  #chiron-popup .settings-close:hover,
  #chiron-popup .chiron-close:hover {
    background: #e81123 !important;
    border-color: #e81123 !important;
  }
  .chiron-popup .sidebar {
    width: 180px;
    background: #252526;
    border-right: 1px solid #333;
    display: flex; flex-direction: column;
  }
  .chiron-popup .sidebar .history {
    flex: 1; 
    overflow-y: auto;
    padding: 36px 8px 8px 8px;    /* added 36px top padding to clear the title */
    font-size: 12px;
    line-height: 1.4;
  }
  .chiron-popup .sidebar .settings-btn {
    padding: 8px; cursor: pointer;
    text-align: center; border-top: 1px solid #333;
  }
  .chiron-popup .main {
    flex: 1; display: flex; flex-direction: column;
  }
  /* make #mainUI stack its children vertically */
  #chiron-popup #mainUI {
    display: flex;
    flex-direction: column;
    height: 100%;      /* fill the .main container */
    min-height: 0;     /* allow flex child to shrink below content size */
  }
  .chiron-popup .prompt-container {
    position: relative;
    padding: 12px;
    background: #1e1e1e;
    border-bottom: 1px solid #333;
    flex: 0 0 auto;    /* don't grow or shrink */
  }
  .chiron-popup .prompt-container input {
    width: 80%;
    padding: 8px 12px;
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
    caret-color: #fff;
  }
  .chiron-popup .prompt-container .ghost {
    position: absolute;
    top: 20px; left: 24px;
    pointer-events: none;
    color: #888;
    font-family: inherit;
    font-size: 14px;
    white-space: pre;
  }
  .chiron-popup .prompt-container .suggestions {
    background: #252526;
    border: 1px solid #3c3c3c;
    margin-top: 4px;
    border-radius: 4px;
    max-height: 120px;
    overflow-y: auto;
    display: none;
  }
  .chiron-popup .prompt-container .suggestions .item {
    padding: 6px 12px; cursor: pointer;
  }
  .chiron-popup .prompt-container .suggestions .item.selected {
    background: #094771; color: #fff;
  }
  .chiron-popup .status {
    flex: 0 0 auto;    /* don't grow or shrink */
    padding: 12px;
    font-size: 13px; 
    line-height: 1.5;
  }

  /* Helpful Links Panel */
  .chiron-popup .helpful-links {
    display: none;
    margin: 12px;
    padding: 12px;
    background: #252526;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
    flex: 1 1 auto;    /* grow and shrink as needed */
    min-height: 0;     /* allow shrinking below content size */
    overflow-y: auto;  /* scroll if content overflows */
  }

  .chiron-popup .helpful-links h4 {
    margin: 0 0 8px 0;
    color: #fff;
    font-size: 14px;
    flex: 0 0 auto;    /* don't grow or shrink */
  }

  .chiron-popup .helpful-links .summary {
    color: #ddd;
    font-size: 13px;
    line-height: 1.4;
    flex: 0 0 auto;    /* don't grow or shrink */
  }

  .chiron-popup .helpful-links .loading {
    color: #888;
    font-style: italic;
  }

  .chiron-popup .helpful-links .error {
    color: #f14c4c;
    font-size: 12px;
    margin-top: 8px;
  }

  .chiron-popup .controls {
    padding: 8px;
    display: flex; 
    justify-content: flex-end; 
    gap: 8px;
    background: #1e1e1e;
    border-top: 1px solid #333;
    flex: 0 0 auto;    /* don't grow or shrink */
  }
  .chiron-popup .controls button {
    background: #0e639c; color: #fff;
    border: none; padding: 6px 14px;
    border-radius: 4px; cursor: pointer; font-size: 13px;
  }
  .chiron-popup .controls button:disabled {
    background: #333; cursor: not-allowed;
  }
  /*──────────────────────────────────────────
    Settings pane, inside the popup
  ──────────────────────────────────────────*/
  #chiron-popup #settingsDrawer {
    display: none;                  /* start hidden */
    position: absolute;             /* overlay the right half */
    top: 0;
    left: 180px;                    /* same width as your .sidebar */
    width: calc(100% - 180px);
    height: 100%;
    background: #252526;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    border-radius: 0 8px 8px 0;     /* round only the right corners */
    padding: 12px;
    color: #ccc;
    font-size: 13px;
    z-index: 2147483648;            /* just above the main popup */
  }

  /* Close-button in the settings pane */
  #chiron-popup #settingsDrawer .settings-close {
    position: absolute;
    top: 12px;
    right: 36px;        /* moved even more to the left */
    width: 20px;
    height: 20px;
    background: transparent;
    border: 1px solid #fff;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
    line-height: 18px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background-color 0.2s;
  }
  #chiron-popup #settingsDrawer .settings-close:hover {
    background: #e81123;
    border-color: #e81123;
  }
  #chiron-popup #settingsDrawer h3 {
    margin-top: 0; color: #fff;
  }
  #chiron-popup #settingsDrawer label {
    display: block;
    margin-top: 16px;    /* add space after the heading */
  }
  #chiron-popup #settingsDrawer input {
    width: calc(100% - 48px);    /* leave 24px padding on each side */
    padding: 6px;
    margin: 8px 0 16px 0;    /* more space after the input */
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
    color: #fff;
  }
  #chiron-popup #settingsDrawer button {
    background: #0e639c;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
  }

  /* Automation options panel */
  #chiron-popup #automationOptions {
    display: none;
    margin-top: 12px;
    padding: 12px;
    background: #252526;
    border: 1px solid #3c3c3c;
    border-radius: 4px;
  }

  #chiron-popup #automationOptions .automation-btn {
    background: #0e639c;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    margin: 4px;
    font-size: 13px;
  }

  #chiron-popup #automationOptions .automation-btn:hover {
    background: #1177bb;
  }

  #chiron-popup #automationOptions .automation-retry-btn {
    background: #6c5ce7;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    margin: 4px;
    font-size: 13px;
  }

  #chiron-popup #automationOptions .automation-retry-btn:hover {
    background: #7d6ff0;
  }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- 2) Check Privacy Policy Acceptance ----
  chrome.storage.local.get("privacyAccepted", function (result) {
    if (result.privacyAccepted) {
      initializePopupUI();
    } else {
      showPrivacyOverlay();
    }
  });

  function showPrivacyOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "privacy-overlay";
    overlay.innerHTML = `
      <div class="privacy-content">
        <h2>Privacy Policy</h2>
        <p>
          This extension uses OpenAI's GPT API to provide intelligent navigation assistance. 
          When you use this extension, your navigation instructions and the current page's DOM 
          structure are sent to OpenAI's servers for processing. This data is used solely to 
          generate appropriate navigation steps and is not stored permanently.
        </p>
        <p>
          We do not collect or store any personal information. The extension only uses 
          Chrome's local storage to remember your API key and privacy acceptance. 
          You can revoke this acceptance at any time by clearing your browser data 
          or uninstalling the extension.
        </p>
        <button class="privacy-accept">Accept & Continue</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Handle accept button click
    overlay
      .querySelector(".privacy-accept")
      .addEventListener("click", function () {
        chrome.storage.local.set({ privacyAccepted: true }, function () {
          overlay.remove();
          initializePopupUI();
        });
      });
  }

  function initializePopupUI() {
    // ---- 3) Inject HTML markup ----
    const html = `
      <div class="chiron-popup" id="chiron-popup">
        <button id="chiron-close" class="chiron-close" title="Close Chiron">&times;</button>

        <div class="sidebar">
          <div class="history" id="history"></div>
          <div class="settings-btn" id="openSettings">⚙️ Settings</div>
        </div>

        <div class="main" id="chiron-main">
          <div id="mainUI">
            <div class="prompt-container">
              <input type="text" id="userPrompt" placeholder="Type your instruction…" autocomplete="off"/>
            </div>
            <div class="status" id="statusMessage">Ready to guide you.</div>
            <div class="helpful-links" id="helpfulLinks">
              <h4>Summary</h4>
              <div class="summary"></div>
            </div>
            <div id="automationOptions">
              <button id="manualBtn" class="automation-btn">Run Guide</button>
              <button id="autoBtn" class="automation-btn">Automate Task</button>
              <button id="retryBtn" class="automation-retry-btn">Not what you're looking for? Try searching again</button>
            </div>
            <div class="controls">
              <button id="stop" disabled>Stop</button>
              <button id="start" disabled>Go</button>
            </div>
          </div>

          <div id="settingsDrawer">
            <button id="settings-close" class="settings-close" title="Close settings">&times;</button>
            <h3>Chiron Settings</h3>
            <label>API Key:</label>
            <input
              type="password"
              id="apiKeyInput"
              placeholder="sk-…"
              autocomplete="new-password"
            />
            <button id="saveSettings">Save</button>
          </div>
        </div>
      </div> 
    `;
    const wrapper = document.createElement("div");
    wrapper.id = "chiron-wrapper";
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);

    // ---- 4) Grab element refs ----
    const promptInput = document.getElementById("userPrompt");
    const startBtnEl = document.getElementById("start");
    const stopBtnEl = document.getElementById("stop");
    const statusEl = document.getElementById("statusMessage");
    const historyEl = document.getElementById("history");
    const automationOptions = document.getElementById("automationOptions");
    const manualBtn = document.getElementById("manualBtn");
    const autoBtn = document.getElementById("autoBtn");
    const retryBtn = document.getElementById("retryBtn");
    const openSettingsEl = document.getElementById("openSettings");
    const settingsEl = document.getElementById("settingsDrawer");
    const apiKeyInputEl = document.getElementById("apiKeyInput");
    const saveSettingsEl = document.getElementById("saveSettings");
    const closeBtnEl = document.getElementById("chiron-close");
    const settingsCloseBtn = document.getElementById("settings-close");
    const mainUI = document.getElementById("mainUI");
    const helpfulLinksEl = document.getElementById("helpfulLinks");
    const helpfulLinksSummary = helpfulLinksEl.querySelector(".summary");

    // ---- 5) Load stored API key ----
    loadApiKey().then((key) => {
      if (key) apiKeyInputEl.value = key;
    });

    // ---- 6) Event listeners ----
    promptInput.addEventListener("input", () => {
      helpShown = false;
      startBtnEl.textContent = "Go";
      startBtnEl.disabled = !promptInput.value.trim();
      helpfulLinksEl.style.display = "none";
      helpfulLinksSummary.innerHTML = "";
      statusEl.textContent = "Ready to guide you.";
    });

    startBtnEl.addEventListener("click", async () => {
      const promptText = promptInput.value.trim();
      if (!promptText) return;

      // PHASE 1: Generate and show a one-paragraph summary of steps
      if (!helpShown) {
        statusEl.textContent = "⏳ Generating summary…";
        startBtnEl.disabled = true;
        helpfulLinksEl.style.display = "block";
        helpfulLinksSummary.innerHTML =
          '<div class="loading">Generating summary…</div>';

        try {
          const apiKey = await loadApiKey();
          if (!apiKey) throw new Error("No API key available");

          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are an expert assistant. Provide a concise, one-paragraph summary of steps that help the user solve their request in plain language.",
                  },
                  {
                    role: "user",
                    content: `The user is on ${window.location.href} and asks: "${promptText}".`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 150,
              }),
            }
          );

          const data = await response.json();
          const summary = data.choices?.[0]?.message?.content?.trim();
          if (!summary) throw new Error("No summary generated");

          helpfulLinksSummary.textContent = summary;
        } catch (err) {
          console.error("Failed to generate summary:", err);
          helpfulLinksSummary.innerHTML =
            '<div class="error">Could not generate summary.</div>';
        }

        // Switch button to "Begin Guide"
        startBtnEl.textContent = "Begin Guide";
        startBtnEl.disabled = false;
        promptInput.disabled = true;
        helpShown = true;
        statusEl.textContent = "🔍 Review the summary, then click Begin Guide.";
        return;
      }

      // PHASE 2: User clicked "Begin Guide," so send both prompt+summary to background.js
      statusEl.textContent = "🔄 Starting guide…";
      startBtnEl.disabled = true;
      try {
        await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            {
              action: "startGuide",
              prompt: promptText,
              url: window.location.href,
              summaryText: helpfulLinksSummary.textContent,
            },
            resolve
          )
        );
        hidePopup();
        statusEl.textContent = "✅ Guide launched";
      } catch (err) {
        console.error("Error launching guide:", err);
        statusEl.textContent = `❌ ${err.message}`;
        startBtnEl.disabled = false;
      }
    });

    stopBtnEl.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "stopGuide" }, () => {
        // Restore UI for the next prompt
        stopBtnEl.disabled = true;
        startBtnEl.disabled = false;
        promptInput.disabled = false;
        statusEl.textContent = "⏹️ Guide stopped";
      });
    });

    openSettingsEl.addEventListener("click", () => {
      mainUI.style.display = "none"; // hide just the UI
      settingsEl.style.display = "block"; // show settings
    });

    settingsCloseBtn.addEventListener("click", () => {
      settingsEl.style.display = "none"; // hide settings
      mainUI.style.display = ""; // let your CSS take back control
    });

    saveSettingsEl.addEventListener("click", () => {
      saveApiKey(apiKeyInputEl.value);
      // only give feedback—leave settings open
      statusEl.textContent = "✅ API key saved";
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "error") {
        statusEl.textContent = `❌ ${message.message}`;
      } else if (message.action === "status") {
        statusEl.textContent = message.message;
      }
    });

    // Wire up close button
    closeBtnEl.addEventListener("click", () => {
      hidePopup();
    });
  }

  // ---- Helper Functions ----
  function hidePopup() {
    const wrapper = document.getElementById("chiron-wrapper");
    if (wrapper) {
      wrapper.style.display = "none";
    }
  }

  function showPopup() {
    const wrapper = document.getElementById("chiron-wrapper");
    if (wrapper) {
      wrapper.style.display = ""; // revert to whatever CSS originally set
    }
  }

  function appendHistory(speaker, text) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<strong>${speaker}:</strong> ${escapeHtml(text)}`;
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function loadApiKey() {
    return new Promise((r) =>
      chrome.storage.local.get("chironApiKey", (d) => r(d.chironApiKey || ""))
    );
  }

  function saveApiKey(key) {
    chrome.storage.local.set({ chironApiKey: key });
  }

  function resetUI() {
    promptInput.disabled = false;
    promptInput.value = "";
    startBtnEl.disabled = true;
    stopBtnEl.disabled = true;
  }
})();
