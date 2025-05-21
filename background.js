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

// ★ Replace with your own key ★
const OPENAI_API_KEY =
  "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";

// Firebase configuration
const FIREBASE_PROJECT_ID = "chiron-nbfpl-test";
const FIREBASE_FUNCTIONS_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;

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

// Validate API key on startup
if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-api-key-here") {
  console.error("❌ OpenAI API key is not set or is invalid");
  chrome.runtime.sendMessage({
    action: "error",
    message: "OpenAI API key is not configured. Please check your API key.",
  });
} else {
  console.log("✅ API key is set:", OPENAI_API_KEY.substring(0, 10) + "...");
}

let userPrompt = ""; // holds the instructions for this session

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

// Log all incoming messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`📨 Received message: ${msg.action}`, msg);

  switch (msg.action) {
    case "persistGuideState":
      if (sender.tab?.id) {
        console.log(`📥 Received guide state from tab ${sender.tab.id}`);
        const key = GUIDE_KEY(sender.tab.id);
        chrome.storage.local.set({ [key]: msg.state }, () => {
          sendResponse({ success: true });
        });
        return true;
      }
      break;

    case "startGuide":
      // ← ensure analyzeDom sees our prompt
      userPrompt = msg.prompt;
      // Get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        try {
          // Send message to content script
          const response = await chrome.tabs.sendMessage(tabs[0].id, msg);
          sendResponse(response);
        } catch (error) {
          console.error("❌ Error routing message to content script:", error);
          sendResponse({ success: false, error: error.message });
        }
      });
      return true;

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
                const response = await chrome.tabs.sendMessage(tabs[0].id, msg);
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
      userPrompt = msg.prompt;
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
      analyzeDomForGuidance(msg.domSnapshot, sender, sendResponse);
      return true;

    case "runCanvaPrompt":
      (async () => {
        try {
          // Get API key from storage
          const key = await new Promise((r) =>
            chrome.storage.local.get("chironApiKey", (d) => r(d.chironApiKey))
          );
          if (!key) {
            sendResponse({ success: false, error: "No API key configured" });
            return;
          }

          // Get the manual guides listing
          const guides = await fetch(chrome.runtime.getURL("Canva.json"))
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
                Authorization: `Bearer ${key}`,
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
                    content: `User request: "${msg.prompt}"\nRespond with the single best guide key exactly.`,
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
        chrome.tabs.sendMessage(sender.tab.id, msg, sendResponse);
        return true;
      }
      break;

    // ─── Forward the manual guide trigger ──────────────────
    case "startManualGuide":
      if (sender.tab?.id) {
        console.log(`📤 Forwarding startManualGuide to tab ${sender.tab.id}`);
        chrome.tabs.sendMessage(sender.tab.id, msg, sendResponse);
        return true; // keep the port open for the async response
      }
      break;

    case "fetchSuggestion":
      (async () => {
        try {
          // get API key (either passed in or from storage)
          const key =
            msg.apiKey ||
            (await new Promise((r) =>
              chrome.storage.local.get("chironApiKey", (d) => r(d.chironApiKey))
            ));
          // call OpenAI
          const apiRes = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              prompt: msg.prompt,
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

async function analyzeDomForGuidance(domSnapshot, sender, sendResponse) {
  try {
    console.log("🔄 Analyzing DOM for guidance...");

    // Get user ID for this session
    const userId = await getUserId();

    // Save DOM snapshot to Firebase
    await fetch(`${FIREBASE_FUNCTIONS_URL}/saveDomSnapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: sender.tab.url,
        userId: userId,
        timestamp: new Date().toISOString(),
        elements: domSnapshot,
      }),
    });

    // Retrieve past snapshots from Firebase
    // const mem = await fetch(`${FIREBASE_FUNCTIONS_URL}/retrieveMemory`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     url: sender.tab.url,
    //     limit: 5,
    //   }),
    // }).then((r) => r.json());

    // const pastSnapshots = mem.memories;
    const pastSnapshots = [];

    // 1️⃣ Build the JSON payload for the AI
    const payload = {
      model: "gpt-4o-mini", // or "gpt-4o-mini" for lower cost
      messages: [
        {
          role: "system",
          content:
            "You are an expert DOM analysis model specialized in generating highly precise and robust interaction sequences across diverse and dynamic web interfaces. " +
            "You translate a DOM snapshot and a user's high-level objective into an exact, logically ordered set of actionable steps a user or automation can follow to complete that objective reliably. " +
            "For each step, do the following: " +
            "1) Identify all candidate interactive elements (buttons, links, input fields, dropdowns, checkboxes, radio buttons, textareas) that could advance the user's goal. " +
            "2) Perform a probability analysis using your model confidence and DOM context to rank these candidates; select the element with the highest likelihood of being the correct next step. " +
            "3) Determine the most stable, unique CSS selector for that chosen element, prioritizing in order: id attributes, data-* attributes, aria-label, name attributes, class names with enough specificity, then nth-of-type or attribute selectors, and as a last resort a full nested path. " +
            "4) Provide the full XPath expression for the element. " +
            "5) Extract the element's visible text, placeholder, or aria-label as the text field. " +
            "6) If the element is inside a shadow DOM or iframe, include the appropriate shadow-host or iframe selector syntax in the CSS selector (e.g., 'shadow-host-selector >>> #element', 'iframe[name=\"login\"] #submit'). " +
            "7) Ensure the selector matches exactly one element; if not, iteratively refine it until it does. " +
            "8) If the element may load asynchronously, include in the description a note to wait for element to be visible." +
            "9) Write a concise imperative description of the action (e.g., Click the login button, Enter text into the search input). " +
            "Focus exclusively on interactive UI components. Do not include any non-interactive elements or commentary. " +
            "Return ONLY a valid JSON array matching this exact structure: " +
            '[{"step": 1, "element": "Login Button", "action": "click", "selector": "#login-btn", "xpath": "//button[@id=\'login-btn\']", "text": "Log In", "description": "Click the login button"}]',
        },
        {
          role: "user",
          content:
            "Here is the user's goal: " +
            userPrompt +
            "\n\n" +
            "Here is a snapshot of the current DOM: " +
            domSnapshot +
            "\n\n" +
            "Here are past snapshots for context: " +
            JSON.stringify(pastSnapshots),
        },
      ],
    };

    // 2️⃣ Send the request to OpenAI
    console.log("🔄 Sending DOM analysis request to OpenAI...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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

    // After generating steps, record the interaction
    await fetch(`${FIREBASE_FUNCTIONS_URL}/recordInteraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId,
        url: sender.tab.url,
        query: userPrompt,
        stepsOffered: steps.map((s) => ({
          step: s.step,
          chosen: s.chosen ?? false,
        })),
        timestamp: new Date().toISOString(),
      }),
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
