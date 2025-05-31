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

  .chiron-popup .helpful-links .links {
    margin-bottom: 12px;
    flex: 0 0 auto;    /* don't grow or shrink */
  }

  .chiron-popup .helpful-links .links a {
    display: block;
    color: #0e639c;
    text-decoration: none;
    margin-bottom: 4px;
    font-size: 13px;
  }

  .chiron-popup .helpful-links .links a:hover {
    text-decoration: underline;
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
          <div class="helpful-links" id="helpfulLinks">
            <h4>Helpful Links</h4>
            <div class="links"></div>
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

  // ---- 3) Grab element refs ----
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
  const helpfulLinksContent = helpfulLinksEl.querySelector(".links");
  const helpfulLinksSummary = helpfulLinksEl.querySelector(".summary");

  // ---- 4) Load stored API key ----
  loadApiKey().then((key) => {
    if (key) apiKeyInputEl.value = key;
  });

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

  // ---- 5) Event listeners ----
  promptInput.addEventListener("input", () => {
    helpShown = false;
    startBtnEl.textContent = "Go";
    startBtnEl.disabled = !promptInput.value.trim();
    // Hide or clear helpful links + summary, so we rebuild for new prompt:
    helpfulLinksEl.style.display = "none";
    helpfulLinksContent.innerHTML = "";
    helpfulLinksSummary.innerHTML = "";
    statusEl.textContent = "Ready to guide you.";
  });

  startBtnEl.addEventListener("click", async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    // If we haven't shown help links & summary yet, do that first:
    if (!helpShown) {
      statusEl.textContent = "⏳ Building helpful links + summary…";
      startBtnEl.disabled = true;
      // Show helpful-links container:
      helpfulLinksEl.style.display = "block";
      helpfulLinksContent.innerHTML =
        '<div class="loading">Loading helpful links…</div>';
      helpfulLinksSummary.innerHTML =
        '<div class="loading">Generating summary…</div>';

      // 1) Insert helpful links:
      const links = generateHelpfulLinks(window.location.hostname);
      helpfulLinksContent.innerHTML = links
        .map((link) => `<a href="${link.url}" target="_blank">${link.text}</a>`)
        .join("");

      // 2) Generate summary via OpenAI:
      try {
        const apiKey = await loadApiKey();
        if (apiKey) {
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
                      "You are an expert assistant. Provide a concise, one-paragraph explanation that helps the user solve their request, referencing any documentation if helpful.",
                  },
                  {
                    role: "user",
                    content: `The user is on ${window.location.href}. The user's question is: "${promptText}".`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 150,
              }),
            }
          );
          const data = await response.json();
          if (data.choices?.[0]?.message?.content) {
            helpfulLinksSummary.textContent = data.choices[0].message.content;
          } else {
            throw new Error("No summary generated");
          }
        } else {
          throw new Error("No API key configured");
        }
      } catch (err) {
        console.error("Failed to generate summary:", err);
        helpfulLinksSummary.innerHTML =
          '<div class="error">Could not generate summary.</div>';
      }

      // Now prompt user to begin the guide:
      startBtnEl.textContent = "Begin Guide";
      startBtnEl.disabled = false;
      promptInput.disabled = true;
      helpShown = true;
      statusEl.textContent =
        "🔍 Review the links & summary, then click Begin Guide.";
      return;
    }

    // If helpShown === true, user has already reviewed links & summary → start guide:
    statusEl.textContent = "🔄 Starting guide…";
    startBtnEl.disabled = true;
    try {
      // Send the actual startGuide message to background:
      await new Promise((r) =>
        chrome.runtime.sendMessage(
          {
            action: "startGuide",
            prompt: promptText,
            url: window.location.href,
          },
          r
        )
      );
      // Finally, hide the popup so the guide can run:
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

  // Helper to generate documentation links
  function generateHelpfulLinks(hostname) {
    const links = [];

    // Try common documentation paths
    const docPaths = [
      { path: "/docs", text: "Documentation" },
      { path: "/help", text: "Help Center" },
      { path: "/support", text: "Support" },
      { path: "/guide", text: "User Guide" },
    ];

    for (const { path, text } of docPaths) {
      const url = `https://${hostname}${path}`;
      links.push({ url, text });
      if (links.length >= 2) break;
    }

    // If we don't have enough links, add a site-scoped search
    if (links.length < 2) {
      links.push({
        url: `https://google.com/search?q=site:${hostname}`,
        text: "Search this site",
      });
    }

    return links;
  }

  // When the guide completes or is exited, re-open the popup preserving state:
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "guideEnded") {
      showPopup();
      // Reset button label so user can re-launch or refine
      startBtnEl.textContent = "Go";
      startBtnEl.disabled = false;
      promptInput.disabled = false;
      helpShown = false;
      statusEl.textContent = "Ready to guide you.";
      // Leave promptInput.value and helpful-links content as-is
    }
  });
})();
