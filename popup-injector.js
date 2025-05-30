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

  // ---- 4) Load stored API key ----
  loadApiKey().then((key) => {
    if (key) apiKeyInputEl.value = key;
  });

  // ---- Helper Functions ----
  function closePopup() {
    const wrapper = document.getElementById("chiron-wrapper");
    if (wrapper) wrapper.remove();
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
    startBtnEl.disabled = !promptInput.value.trim();
  });

  startBtnEl.addEventListener("click", async () => {
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    statusEl.textContent = "⏳ Processing...";
    startBtnEl.disabled = true;
    automationOptions.style.display = "none";

    // DOMAIN CHECK:
    if (window.location.hostname.includes("canva.com")) {
      // 🖼️ Canva-only flow: classify → show manual vs automation buttons
      statusEl.textContent = "⏳ Processing Canva request…";
      try {
        const response = await new Promise((r) =>
          chrome.runtime.sendMessage(
            {
              action: "runCanvaPrompt",
              prompt: promptText,
            },
            r
          )
        );

        if (!response.success) {
          throw new Error(response.error || "No matching guide found");
        }

        // Show automation options with the guide key
        statusEl.textContent = `✨ Found guide "${response.key}". Choose how to proceed:`;
        statusEl.setAttribute("data-guide-key", response.key);
        automationOptions.style.display = "block";

        // Wire up the buttons
        manualBtn.onclick = async () => {
          try {
            statusEl.textContent = "🔄 Starting manual guide...";
            automationOptions.style.display = "none";

            await new Promise((r) =>
              chrome.runtime.sendMessage(
                {
                  action: "startManualGuide",
                  key: response.key,
                },
                r
              )
            );

            statusEl.textContent = `✅ Manual guide "${response.key}" started`;
            closePopup();
          } catch (err) {
            console.error("Error starting manual guide:", err);
            statusEl.textContent = `❌ ${err.message}`;
            resetUI();
          }
        };

        autoBtn.onclick = async () => {
          try {
            const guideKey = statusEl.getAttribute("data-guide-key");
            if (!guideKey) {
              throw new Error("No guide key found");
            }

            statusEl.textContent = "🤖 Starting automation...";
            automationOptions.style.display = "none";
            autoBtn.disabled = true;

            const [{ tabId }] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });

            const [result] = await chrome.scripting.executeScript({
              target: { tabId },
              func: async (guideKey) => {
                try {
                  // Load automation configuration
                  const cfg = await fetch(
                    chrome.runtime.getURL("Canva.automation.json")
                  ).then((r) => r.json());
                  const task = cfg.automationGuides.find(
                    (a) => a.key === guideKey
                  );

                  if (!task) {
                    throw new Error(
                      `No automation found for key "${guideKey}"`
                    );
                  }

                  console.group(
                    `🌟 Running Canva automation for "${guideKey}"`
                  );

                  for (const [i, step] of task.automationSteps.entries()) {
                    console.log(
                      `— Step ${i + 1}/${task.automationSteps.length}:`,
                      step
                    );

                    // Wait for element to be visible and enabled
                    const el = await new Promise((resolve, reject) => {
                      let elapsed = 0;
                      const interval = 100;
                      const check = () => {
                        const element = document.querySelector(step.selector);
                        if (
                          element &&
                          element.offsetParent !== null &&
                          !element.disabled &&
                          window.getComputedStyle(element).visibility !==
                            "hidden"
                        ) {
                          return resolve(element);
                        }
                        if ((elapsed += interval) >= (step.delay || 5000)) {
                          return reject(
                            new Error(
                              `Timeout waiting for visible selector: ${step.selector}`
                            )
                          );
                        }
                        setTimeout(check, interval);
                      };
                      check();
                    });

                    // Scroll into view instantly and wait for reflow
                    el.scrollIntoView({ behavior: "auto", block: "center" });
                    await new Promise((r) => setTimeout(r, 500));

                    // Re-query the element to ensure we have a fresh reference
                    const freshEl = document.querySelector(step.selector);
                    if (!freshEl) {
                      throw new Error(
                        `Element disappeared after becoming visible: ${step.selector}`
                      );
                    }

                    try {
                      switch (step.action) {
                        case "click":
                          console.log(
                            `👉 [Step ${i + 1}] Clicking`,
                            step.selector
                          );
                          freshEl.click(); // This click will be trusted since it's in the context of a user gesture
                          break;

                        case "type":
                          const text = step.value || "";
                          console.log(
                            `⌨️ [Step ${i + 1}] Typing into ${step.selector}:`,
                            JSON.stringify(text)
                          );
                          freshEl.focus();
                          if ("value" in freshEl) {
                            freshEl.value = text;
                            freshEl.dispatchEvent(
                              new Event("input", { bubbles: true })
                            );
                            freshEl.dispatchEvent(
                              new Event("change", { bubbles: true })
                            );
                          } else {
                            freshEl.innerText = text;
                            freshEl.dispatchEvent(
                              new InputEvent("input", { bubbles: true })
                            );
                            freshEl.dispatchEvent(
                              new Event("change", { bubbles: true })
                            );
                          }
                          break;

                        case "pressEnter":
                          console.log(
                            `⏎ [Step ${i + 1}] Pressing Enter on`,
                            step.selector
                          );
                          freshEl.dispatchEvent(
                            new KeyboardEvent("keydown", {
                              key: "Enter",
                              bubbles: true,
                            })
                          );
                          freshEl.dispatchEvent(
                            new KeyboardEvent("keyup", {
                              key: "Enter",
                              bubbles: true,
                            })
                          );
                          freshEl.dispatchEvent(
                            new KeyboardEvent("keypress", {
                              key: "Enter",
                              bubbles: true,
                            })
                          );
                          break;

                        default:
                          console.warn(
                            `⚠️ [Step ${i + 1}] Unknown action "${step.action}"`
                          );
                      }
                    } catch (err) {
                      console.error(
                        `❌ [Step ${i + 1}] Action "${step.action}" failed:`,
                        err
                      );
                      throw err;
                    }

                    // Wait for any animations or state changes to complete
                    await new Promise((r) => setTimeout(r, step.delay || 500));
                  }

                  console.log(`✅ Completed automation for "${guideKey}"`);
                  console.groupEnd();
                  return { success: true };
                } catch (err) {
                  console.error("🚨 Canva automation error:", err);
                  return { success: false, error: err.message };
                }
              },
              args: [guideKey],
            });

            if (!result.result.success) {
              throw new Error(result.result.error || "Automation failed");
            }

            statusEl.textContent = `✅ Automated "${guideKey}"`;
            closePopup();
          } catch (err) {
            console.error("Error starting automation:", err);
            statusEl.textContent = `❌ ${err.message}`;
            resetUI();
          }
        };

        retryBtn.onclick = () => {
          statusEl.textContent = "Ready to guide you.";
          automationOptions.style.display = "none";
          resetUI();
        };
      } catch (err) {
        console.error("❌ Error:", err);
        statusEl.textContent = `❌ ${err.message}`;
        resetUI();
      } finally {
        startBtnEl.disabled = false;
      }
    } else {
      // 🌐 Universal flow: kick off the generic guide immediately
      statusEl.textContent = "🔄 Starting guide…";
      try {
        await new Promise((r) =>
          chrome.runtime.sendMessage(
            { action: "startGuide", prompt: promptText },
            r
          )
        );
        statusEl.textContent = "✅ Guide started";
        closePopup();
      } catch (err) {
        statusEl.textContent = `❌ ${err.message}`;
        startBtnEl.disabled = false;
      }
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
    const wrapper = document.getElementById("chiron-wrapper");
    if (wrapper) wrapper.remove();
  });
})();
