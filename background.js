// background.js
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["popup-injector.js"],
  });
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

// 1) Receive and store from content.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "persistGuideState" && sender.tab?.id) {
    console.log(`📥 Received guide state from tab ${sender.tab.id}`);
    const key = GUIDE_KEY(sender.tab.id);
    chrome.storage.local.set({ [key]: msg.state });
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
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  console.log(`🔄 Tab ${tabId} finished loading`);

  const key = GUIDE_KEY(tabId);
  const data = await chrome.storage.local.get(key);
  const state = data[key];

  if (!state) {
    console.log(`⚠️ No guide state found for tab ${tabId}`);
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

// Clean up guide state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const key = GUIDE_KEY(tabId);
  chrome.storage.local.remove(key);
});

// Log all incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`📨 Received message: ${message.action}`, message);

  // ─── Set or clear the prompt ────────────────────────────────────
  if (message.action === "setPrompt") {
    userPrompt = message.prompt;
    console.log("✅ Prompt set:", userPrompt);
    sendResponse({ success: true, prompt: userPrompt });
    return true;
  }

  if (message.action === "clearPrompt") {
    userPrompt = "";
    console.log("✅ Prompt cleared");
    sendResponse({ success: true });
    return true;
  }

  // ─── Route messages to content script ──────────────────────────
  if (message.action === "startGuide" || message.action === "stopGuide") {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }

      try {
        // Send message to content script
        const response = await chrome.tabs.sendMessage(tabs[0].id, message);
        sendResponse(response);
      } catch (error) {
        console.error("❌ Error routing message to content script:", error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep the message channel open for the async response
  }

  // ─── Analyze DOM for guidance ──────────────────────────────────
  if (message.action === "analyzeDom") {
    if (!userPrompt) {
      sendError("No instructions provided. Please enter instructions first.");
      sendResponse({ success: false, error: "No instructions provided" });
      return true;
    }

    analyzeDomForGuidance(message.domSnapshot, sender, sendResponse);
    return true; // Keep the message channel open for the async response
  }

  // ─── Get next step after completing current step ──────────────
  if (message.action === "getNextStep") {
    if (!userPrompt) {
      sendError("No instructions provided. Please enter instructions first.");
      sendResponse({ success: false, error: "No instructions provided" });
      return true;
    }

    getNextStep(message.currentStep, message.domSnapshot, sender, sendResponse);
    return true; // Keep the message channel open for the async response
  }

  // ─── Persist guide state ─────────────────────────────────────
  if (message.action === "persistGuideState" && sender.tab?.id) {
    console.log(`📥 Received guide state from tab ${sender.tab.id}`);
    const key = GUIDE_KEY(sender.tab.id);
    chrome.storage.local.set({ [key]: message.state });
    // No response needed for state persistence
    return false;
  }
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
            "You are a DOM analysis expert that can help users navigate websites. " +
            "Given a DOM snapshot and a user's goal, identify the most logical sequence of steps to achieve that goal. " +
            "For each step, find the exact DOM element to interact with and provide its details. " +
            "Focus only on UI elements that can be interacted with (buttons, links, input fields, dropdowns, etc.) " +
            "Return ONLY a JSON array with this structure: " +
            '[{"step": 1, "element": "Login Button", "action": "click", ' +
            '"selector": "#login-btn", "xpath": "//button[@id=\'login-btn\']", ' +
            '"text": "Log In", "description": "Click the login button"}]',
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
          stepNumber: s.stepNumber,
          chosen: s.chosen,
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

async function getNextStep(currentStep, domSnapshot, sender, sendResponse) {
  try {
    console.log("🔄 Getting next step after step", currentStep);

    // 1️⃣ Build the JSON payload for the AI
    const payload = {
      model: "gpt-4o-mini", // Use smaller model for this simpler task
      messages: [
        {
          role: "system",
          content:
            "You are a DOM analysis expert that can help users navigate websites. " +
            "Given a DOM snapshot and a user's goal, identify the most logical sequence of steps to achieve that goal. " +
            "For each step, find the exact DOM element to interact with and provide its details. " +
            "You MUST include ALL of these properties in each step of your response: " +
            "- step: The step number (integer) " +
            "- element: A descriptive name for the element " +
            "- action: What action to take (click, type, select, hover, etc.) " +
            "- selector: A CSS selector that uniquely identifies this element " +
            "- xpath: An XPath that uniquely identifies this element " +
            "- text: The text content of the element, if any " +
            "- description: A brief description of what this step accomplishes " +
            "Return your response as a JSON array with EXACTLY this structure, nothing more or less. " +
            'Example: [{"step": 1, "element": "Login Button", "action": "click", ' +
            '"selector": "#login-btn", "xpath": "//button[@id=\'login-btn\']", ' +
            '"text": "Log In", "description": "Click the login button"}]',
        },
        {
          role: "user",
          content:
            "My goal is: " +
            userPrompt +
            "\n\n" +
            "I just completed step " +
            currentStep +
            ". What should I do next? \n\n" +
            "Here is the current DOM: " +
            domSnapshot,
        },
      ],
    };

    // 2️⃣ Send the request to OpenAI
    console.log("🔄 Sending next step request to OpenAI...");
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

    // 4️⃣ Parse the next step
    const data = await res.json();
    const assistantContent = data.choices[0].message.content;
    // Clean up any code block formatting if present
    const cleanContent = assistantContent
      .replace(/```json\n/g, "")
      .replace(/```/g, "")
      .trim();

    const nextStep = JSON.parse(cleanContent);
    console.log("✅ Next step:", nextStep);

    // 5️⃣ Send next step back to content script
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "showNextStep",
        step: nextStep,
      });
    }
    sendResponse({ success: true, step: nextStep });
  } catch (err) {
    console.error("❌ Failed to get next step:", err);
    sendError("Failed to get next step", err.message);
    sendResponse({ success: false, error: err.message });
  }
}
