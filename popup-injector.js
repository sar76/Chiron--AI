// popup-injector.js
(function () {
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
  }
  .chiron-popup .prompt-container {
    position: relative;
    padding: 12px;
    background: #1e1e1e;
    border-bottom: 1px solid #333;
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
    flex: 1; padding: 12px;
    overflow-y: auto; font-size: 13px; line-height: 1.5;
  }
  .chiron-popup .controls {
    padding: 8px;
    display: flex; justify-content: flex-end; gap: 8px;
    background: #1e1e1e;
    border-top: 1px solid #333;
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
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- 2) Inject HTML markup ----
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
          <div class="controls">
            <button id="stop" disabled>Stop</button>
            <button id="start" disabled>Go</button>
          </div>
        </div>

        <div id="settingsDrawer">
          <button id="settings-close" class="settings-close" title="Close settings">&times;</button>
          <h3>Chiron Settings</h3>
          <label>API Key:</label>
          <input type="password" id="apiKeyInput" placeholder="sk-…" />
          <button id="saveSettings">Save</button>
        </div>
      </div>
    </div> 
  `;
  const wrapper = document.createElement("div");
  wrapper.id = "chiron-wrapper";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // ---- 3) Grab element refs ----
  const promptInput = document.getElementById("userPrompt");
  const startBtnEl = document.getElementById("start");
  const stopBtnEl = document.getElementById("stop");
  const statusEl = document.getElementById("statusMessage");
  const historyEl = document.getElementById("history");
  const openSettingsEl = document.getElementById("openSettings");
  const settingsEl = document.getElementById("settingsDrawer");
  const apiKeyInputEl = document.getElementById("apiKeyInput");
  const saveSettingsEl = document.getElementById("saveSettings");
  const closeBtnEl = document.getElementById("chiron-close");
  const settingsCloseBtn = document.getElementById("settings-close");
  const mainUI = document.getElementById("mainUI");

  // ---- 4) Load stored API key ----
  loadApiKey().then((key) => {
    if (key) apiKeyInputEl.value = key;
  });

  // ---- 5) Event listeners ----
  promptInput.addEventListener("input", () => {
    startBtnEl.disabled = !promptInput.value.trim();
  });

  startBtnEl.addEventListener("click", async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    statusEl.textContent = "⏳ Processing...";
    startBtnEl.disabled = true;

    try {
      if (location.hostname.includes("canva.com")) {
        // 1) Classify which guide
        const { success, key, error } = await new Promise((r) =>
          chrome.runtime.sendMessage(
            { action: "runCanvaPrompt", prompt: promptText },
            r
          )
        );
        if (!success) throw new Error(error || "No guide found");

        // 2) Ask user Manual vs. Auto
        const doAuto = confirm(
          `Found guide "${key}". Do you want me to perform it automatically?`
        );
        if (doAuto) {
          await new Promise((r) =>
            chrome.runtime.sendMessage({ action: "runCanvaTask", key }, r)
          );
          statusEl.textContent = `✅ Automated "${key}"`;
        } else {
          await new Promise((r) =>
            chrome.runtime.sendMessage({ action: "startManualGuide", key }, r)
          );
          statusEl.textContent = `✅ Manual guide "${key}" started`;
        }
      } else {
        // —— Default AI guide path ——
        appendHistory("You", promptText);
        await runChironGuide(promptText);
        statusEl.textContent = "✅ Done guiding.";
      }
    } catch (err) {
      console.error("❌ Error:", err);
      statusEl.textContent = `❌ ${err.message}`;
    } finally {
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

  // Listen for manual guide exit
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "manualGuideExited") {
      document.getElementById("chiron-popup").style.display = "flex";
    }
  });

  // Wire up close button
  closeBtnEl.addEventListener("click", () => {
    const wrapper = document.getElementById("chiron-wrapper");
    if (wrapper) wrapper.remove();
  });

  // ---- History helper ----
  function appendHistory(speaker, text) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<strong>${speaker}:</strong> ${escapeHtml(text)}`;
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  // ---- Helpers ----
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
  function runChironGuide(prompt) {
    return new Promise((resolve, reject) =>
      loadApiKey().then((key) => {
        chrome.runtime.sendMessage(
          { action: "startGuide", prompt, apiKey: key },
          (resp) => {
            if (!resp || !resp.success) reject(resp?.error || "Failed");
            else resolve();
          }
        );
      })
    );
  }
})();
