// background.js
console.log("🚀 Background script starting...");

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  console.log("🖱️ Extension icon clicked on tab:", tab.id);

  // Only inject popup-injector.js, Canva.js is handled by content_scripts
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["popup-injector.js"],
    });
    console.log("✅ Injected popup-injector.js");
  } catch (err) {
    console.error("❌ Failed to inject popup-injector.js:", err);
  }
});

// Listen for tab updates to check guide state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.includes("canva.com")) {
    const key = `guide_${tabId}`;
    console.log("🔍 Checking guide key:", key);
    chrome.storage.local.get(key, (result) => {
      const state = result[key];
      console.log("📦 Retrieved guide state:", state);
      if (!state) {
        console.warn("⚠️ No guide state found for tab", tabId);
      }
    });
  }
});

// Generate or retrieve user ID
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get("chironUserId", (res) => {
      if (res.chironUserId) {
        return resolve(res.chironUserId);
      }
      // otherwise generate one
      const newId = crypto.randomUUID();
      chrome.storage.local.set({ chironUserId: newId }, () => {
        resolve(newId);
      });
    });
  });
}

// Log when background script loads
console.log("🔄 Background script loaded");

let userPrompt = ""; // holds the instructions for this session
let userSummary = "";

const GUIDE_KEY = (tabId) => `guide_state_${tabId}`;

// Helper to inject content script and wait for it to be ready
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    console.log(`✅ Content script injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to inject content script into tab ${tabId}:`,
      error
    );
    return false;
  }
}

// Helper to send resume message with retries
async function sendResumeMessage(tabId, state, retryCount = 0) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "resumeGuide",
      steps: state.steps,
      currentIndex: state.currentIndex,
    });
    console.log(`✅ Successfully resumed guide in tab ${tabId}`);
  } catch (error) {
    console.error(
      `❌ Failed to send resume message to tab ${tabId} (attempt ${
        retryCount + 1
      }):`,
      error
    );
    if (retryCount < 3) {
      // Wait longer between each retry
      const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
      setTimeout(() => sendResumeMessage(tabId, state, retryCount + 1), delay);
    }
  }
}

/**
 * Fetch the user's OpenAI key from chrome.storage.
 * Resolves to an empty string if none is stored.
 */
async function getApiKeyFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("chironApiKey", (result) => {
      resolve(result.chironApiKey || "");
    });
  });
}

// Warn if no API key is set
(async () => {
  const stored = await getApiKeyFromStorage();
  if (!stored) {
    console.error(
      "❌ No OpenAI API key saved. Please open Chiron's popup and paste your key under Settings."
    );
  }
})();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startGuide") {
    userPrompt = message.prompt;
    userSummary = message.summaryText || "";
    console.log("📢 Background received startGuide; prompt:", userPrompt);
    console.log("📝 Background received summary:", userSummary);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "startGuide",
          prompt: userPrompt,
          url: message.url,
          summaryText: userSummary,
        },
        sendResponse
      );
    });

    return true; // keep channel open for sendResponse
  }

  console.log(`📨 Received message: ${message.action}`, message);

  switch (message.action) {
    case "persistGuideState":
      if (sender.tab?.id) {
        console.log(`📥 Received guide state from tab ${sender.tab.id}`);
        const key = GUIDE_KEY(sender.tab.id);
        chrome.storage.local.set({ [key]: message.state }, () => {
          sendResponse({ success: true });
        });
        return true;
      }
      break;

    case "stopGuide":
      if (sender.tab?.id) {
        chrome.storage.local.remove(GUIDE_KEY(sender.tab.id), () => {
          // then route to content script to exit Intro.js
          chrome.tabs.query(
            { active: true, currentWindow: true },
            async (tabs) => {
              if (tabs.length === 0) {
                sendResponse({ success: false, error: "No active tab found" });
                return;
              }

              try {
                const response = await chrome.tabs.sendMessage(
                  tabs[0].id,
                  message
                );
                sendResponse(response);
              } catch (error) {
                console.error(
                  "❌ Error routing message to content script:",
                  error
                );
                sendResponse({ success: false, error: error.message });
              }
            }
          );
        });
        return true;
      }
      break;

    case "setPrompt":
      userPrompt = message.prompt;
      console.log("✅ Prompt set:", userPrompt);
      sendResponse({ success: true, prompt: userPrompt });
      return true;

    case "clearPrompt":
      userPrompt = "";
      console.log("✅ Prompt cleared");
      sendResponse({ success: true });
      return true;

    case "analyzeDom":
      if (!userPrompt) {
        sendError("No instructions provided. Please enter instructions first.");
        sendResponse({ success: false, error: "No instructions provided" });
        return true;
      }
      analyzeDomForGuidance(message.domSnapshot, sender, sendResponse);
      return true;

    case "runCanvaPrompt":
      (async () => {
        try {
          // Get API key from storage
          const apiKey = await getApiKeyFromStorage();
          if (!apiKey) {
            sendResponse({ success: false, error: "No API key configured" });
            return;
          }

          // Get the manual guides listing
          const guides = await fetch(
            chrome.runtime.getURL("ChironCanva/Canva.json")
          )
            .then((res) => res.json())
            .then((cfg) => cfg.manualGuides || [])
            .catch(() => []);

          const listing = guides
            .map((g) => `- ${g.key}: ${g.intro}`)
            .join("\n");

          // Call OpenAI to classify the prompt
          const res = await fetch(
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
                    content: `You are a classifier for Canva manual guides.\nAvailable guides:\n${listing}`,
                  },
                  {
                    role: "user",
                    content: `User request: "${message.prompt}"\nRespond with the single best guide key exactly.`,
                  },
                ],
                temperature: 0,
              }),
            }
          );

          const data = await res.json();
          const guideKey = data.choices[0].message.content.trim();
          sendResponse({ success: true, key: guideKey });
        } catch (err) {
          console.error("❌ Error running Canva prompt:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;

    case "runCanvaTask":
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, message, sendResponse);
        return true;
      }
      break;

    // ─── Forward the manual guide trigger ──────────────────
    case "startManualGuide":
      if (sender.tab?.id) {
        console.log(`📤 Forwarding startManualGuide to tab ${sender.tab.id}`);
        chrome.tabs.sendMessage(sender.tab.id, message, sendResponse);
        return true; // keep the port open for the async response
      }
      break;

    case "fetchSuggestion":
      (async () => {
        try {
          // get API key from storage
          const apiKey = await getApiKeyFromStorage();
          if (!apiKey) {
            sendResponse({ success: false, error: "No API key configured" });
            return;
          }

          // call OpenAI
          const apiRes = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              prompt: message.prompt,
              max_tokens: 64,
              n: 3,
            }),
          }).then((r) => r.json());
          const options = apiRes.choices.map((c) => c.text || "");
          const inline = options[0] || "";
          sendResponse({ success: true, inline, options });
        } catch (err) {
          console.error("❌ fetchSuggestion failed:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;

    case "manualGuideExited":
      // push the same message back into the tab so popup-injector.js can catch it
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: "manualGuideExited" });
      }
      break;
  }
});

// 2) When our "search" click opens a new tab, copy + advance the state
chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.openerTabId) return;
  console.log(`🆕 New tab created: ${tab.id} from opener ${tab.openerTabId}`);
  const oldKey = GUIDE_KEY(tab.openerTabId);
  chrome.storage.local.get(oldKey, (data) => {
    const oldState = data[oldKey];
    if (!oldState) {
      console.log(`⚠️ No guide state found for opener tab ${tab.openerTabId}`);
      return;
    }
    console.log(`📤 Copying guide state to new tab ${tab.id}`);
    const newState = {
      steps: oldState.steps,
      currentIndex: oldState.currentIndex + 1,
    };
    chrome.storage.local.set({ [GUIDE_KEY(tab.id)]: newState });
  });
});

// 3) When any tab finishes loading, resume if state exists
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  console.log(`🔄 Tab ${tabId} finished loading`);

  const key = GUIDE_KEY(tabId);
  console.log("🔍 Checking guide key:", key);

  chrome.storage.local.get(key, async (data) => {
    const state = data[key];
    console.log("📦 Retrieved guide state:", state);

    if (!state) {
      console.log(`⚠️ No guide state found for tab ${tabId}`);
      return;
    }

    if (state.currentIndex >= state.steps.length - 1) {
      console.log(`🔄 Guide complete; skipping resume for tab ${tabId}`);
      return;
    }

    console.log(
      `📤 Attempting to resume guide in tab ${tabId} at step ${state.currentIndex}`
    );

    // First try to inject the content script
    const injected = await injectContentScript(tabId);
    if (!injected) {
      console.error(`❌ Failed to inject content script into tab ${tabId}`);
      return;
    }

    // Then try to send the resume message
    await sendResumeMessage(tabId, state);
  });
});

// Clean up guide state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const key = GUIDE_KEY(tabId);
  chrome.storage.local.remove(key);
});

// Helper to send errors to both popup and content script
function sendError(message, details = null) {
  console.error(`❌ Error: ${message}`, details ? `Details: ${details}` : "");

  // Send to popup
  chrome.runtime.sendMessage({
    action: "error",
    message: message,
    details: details,
  });

  // Send to content script if we have a tab ID
  if (chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "error",
          message: message,
        });
      }
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// New: Enhanced prompt—always capture a "Login" (or any) button by text if CSS fails
const SYSTEM_PROMPT_START =
  `You are a precise DOM-navigator agent. Given a DOM snapshot (HTML) and a user goal, ` +
  `output a JSON array of step-objects. Each step-object must have exactly these keys: ` +
  `"step", "element", "selector", "xpath", "text", "description". ` +
  `Do not output anything else (no explanations, no markdown). ` +
  `Follow these rules for each step:` +
  `\n\n1. step (integer): The 1-based index (1,2,3…) in the sequence.` +
  `\n2. element (string): A concise, human-friendly name for the element (e.g., "Login Button", "Search Field", "Submit Link").` +
  `\n3. selector (string): A valid CSS selector that matches exactly one element in the snapshot. ` +
  `   - First attempt a unique ID or data-attribute (e.g. "#loginBtn" or "[data-action='next']"). ` +
  `   - Otherwise, use class names + hierarchy (e.g. ".nav > button.sign-in"), ensuring it selects exactly one node. ` +
  `   - If you cannot produce a unique CSS selector for that element, set selector to an empty string and rely on rule 4's fallback.` +
  `\n4. xpath (string): The full XPath pointing to that same element (e.g. "/html/body/div[1]/button[2]"). ` +
  `   - If selector is non-empty, xpath should still point to the identical element. ` +
  `   - If selector is empty, build an XPath using the element's exact visible text or aria-label, for example: //button[text()="Log in"] or //div[@aria-label="Log in"]. ` +
  `     This applies even if the element isn't a <button>, as long as the text or aria-label exactly matches the visible label. ` +
  `   - If inside an iframe, prefix with "iframe[name=\\"…\\"] #xpath_inside".` +
  `\n5. text (string): The element's visible text, placeholder, or aria-label exactly as the user sees it (e.g., "Log in", "Search").` +
  `\n6. description (string): A short imperative instruction on how to interact (e.g. "Click the login button", "Enter password into the field").` +
  `\n\nOnly include interactive elements (buttons, links, inputs, selects, textareas,[role=button],[role=link],[tabindex]>=0). ` +
  `If no CSS selector exists, you must locate the element by its exact text (rule 4's fallback). ` +
  `List steps in logical order to achieve the user's goal. ` +
  `Ensure the final output is valid JSON. Do not wrap the JSON in code fences or add any extra text.\n\n` +
  `Respond with exactly this JSON structure (no extra keys):\n` +
  `[{\n  "step": 1,\n  "element": "Login Button",\n  "selector": "button[aria-label='Log in']",\n  "xpath": "/html/body/div[2]/div[1]/button[1]",\n  "text": "Log in",\n  "description": "Click the login button"\n}]`;
const SYSTEM_PROMPT_END = ``;
// ───────────────────────────────────────────────────────────────────────────────

async function analyzeDomForGuidance(domSnapshot, sender, sendResponse) {
  try {
    console.log("🔄 Analyzing DOM for guidance...");

    // Get API key from storage
    const apiKey = await getApiKeyFromStorage();
    if (!apiKey) {
      throw new Error("No API key configured");
    }

    // Get user ID for this session
    const userId = await getUserId();

    // 1️⃣ Build the JSON payload for the AI
    const payload = {
      model: "gpt-4o-mini", // or "gpt-4o-mini" for lower cost
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_START,
        },
        {
          role: "user",
          content: `DOM Snapshot:\n${domSnapshot}\nUser Intent:\n"${userPrompt}"\nInclude no additional text.`,
        },
      ],
    };

    // 2️⃣ Send the request to OpenAI
    console.log("🔄 Sending DOM analysis request to OpenAI...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    // 3️⃣ Check response
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    // 4️⃣ Parse the steps
    const data = await res.json();
    const assistantContent = data.choices[0].message.content;
    // Clean up any code block formatting if present
    const cleanContent = assistantContent
      .replace(/```json\n/g, "")
      .replace(/```/g, "")
      .trim();

    const steps = JSON.parse(cleanContent);
    console.log("✅ Guidance steps from AI:", steps);

    // Log the selectors being generated
    steps.forEach((step) => {
      console.log(`Step ${step.step}: Selector = "${step.selector}"`);
    });

    // 5️⃣ Send steps back to content script
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "showGuidance",
        steps,
      });
    }
    sendResponse({ success: true, steps });
  } catch (err) {
    console.error("❌ Failed to analyze DOM:", err);
    sendError("Failed to analyze DOM", err.message);
    sendResponse({ success: false, error: err.message });
  }
}
