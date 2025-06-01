// Override history.pushState to detect SPA navigation
(function (history) {
  const origPush = history.pushState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    window.dispatchEvent(new Event("locationchange"));
    return ret;
  };
})(window.history);

// content.js

let currentStepElement = null;
let currentStepNumber = 0;
let allSteps = [];
let errorOverlay = null;
let manualGuides = [];

// Log when content script loads
console.log("🔄 Content script loaded");

// Helper to get API key from chrome.storage
async function getApiKeyFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("chironApiKey", (result) => {
      resolve(result.chironApiKey || "");
    });
  });
}

// Load Intro.js (now preloaded as a content script)
async function loadIntroJs() {
  if (!window.introJs) throw new Error("Intro.js not found");
  return window.introJs;
}

// Utility to check visibility
function isVisibleElement(el) {
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

// Extract element data for serialization
function extractElementData(el) {
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    attributes: getAttributes(el),
    text: el.innerText.trim().substring(0, 100),
    bbox: {
      x: rect.left / window.innerWidth,
      y: rect.top / window.innerHeight,
      w: rect.width / window.innerWidth,
      h: rect.height / window.innerHeight,
    },
  };
}

// Helper to get element attributes
function getAttributes(el) {
  const result = {};
  const attributes = [
    "id",
    "class",
    "name",
    "type",
    "role",
    "aria-label",
    "placeholder",
    "title",
    "href",
    "value",
  ];
  attributes.forEach((attr) => {
    const value = el.getAttribute(attr);
    if (value) result[attr] = value;
  });
  return result;
}

// Serialize interactive DOM elements
function serializeDom() {
  const serialized = [];

  // Expand to include role-based elements
  const interactiveElements = document.querySelectorAll(
    "button, a, input, select, textarea, " +
      "[role='button'], [role='link'], [role='menuitem'], " +
      "[tabindex]:not([tabindex='-1'])"
  );

  console.log(`🔍 Found ${interactiveElements.length} interactive elements`);

  interactiveElements.forEach((element) => {
    if (isVisibleElement(element)) {
      const data = extractElementData(element);
      serialized.push(data);

      // Log Gmail compose button if found
      if (
        element.textContent?.includes("Compose") ||
        element.getAttribute("aria-label")?.includes("Compose")
      ) {
        console.log("📧 Found potential compose button:", data);
      }
    }
  });

  // Also check for role="button" elements
  const roleButtons = document.querySelectorAll('[role="button"]');
  console.log(`🔍 Found ${roleButtons.length} role="button" elements`);

  const contextElements = document.querySelectorAll("h1, h2, h3, label");
  contextElements.forEach((element) => {
    if (isVisibleElement(element)) {
      serialized.push(extractElementData(element));
    }
  });

  return JSON.stringify(serialized).substring(0, 100000);
}

// Error and success messages
function showError(msg) {
  if (!errorOverlay) {
    errorOverlay = document.createElement("div");
    errorOverlay.className = "error-overlay";
    document.body.appendChild(errorOverlay);
  }
  errorOverlay.textContent = msg;
}

function showSuccessMessage(msg) {
  showError(msg);
  setTimeout(() => {
    if (errorOverlay) {
      errorOverlay.remove();
      errorOverlay = null;
    }
  }, 3000);
}

// load guide data from Canva.json
fetch(chrome.runtime.getURL("ChironCanva/Canva.json"))
  .then((res) => res.json())
  .then((data) => {
    console.log("✅ Loaded Canva.json:", data);
    manualGuides = data.manualGuides || [];
  })
  .catch((err) => console.error("Failed to load Canva.json:", err));

// 1) Parse the one-paragraph summary into simple steps
function parseSummaryIntoSteps(summaryText) {
  const sentences = summaryText
    .split(/[\r\n]+|\. /) // split on newlines or ". "
    .map((s) => s.trim())
    .filter((s) => s.length);
  return sentences.map((sentence, idx) => ({
    step: idx + 1,
    rawText: sentence,
    elementName: "", // to fill in Phase 2
    selector: "", // to fill in Phase 2
    xpath: "", // to fill in Phase 2
    description: sentence,
  }));
}

// 2) Take those high-level steps and locate each element in the DOM
async function locateElementsForSteps(steps) {
  const domSnapshot = serializeDom(); // your existing function
  const apiKey = await getApiKeyFromStorage(); // existing helper
  if (!apiKey) throw new Error("No API key configured");

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helper that takes a list of high-level instructions (plain English) and a DOM snapshot. For each instruction, return exactly one CSS selector and one XPath that matches a single element. Output valid JSON array of objects with keys: "step","elementName","selector","xpath". Example:

[
  {
    "step": 1,
    "elementName": "Upload Button",
    "selector": "button#uploadBtn",
    "xpath": "/html/body/div[1]/button[2]"
  },
  {
    "step": 2,
    "elementName": "Submit Form",
    "selector": "form#submitForm",
    "xpath": "/html/body/div[1]/form[1]"
  }
]`,
      },
      {
        role: "user",
        content: `DOM Snapshot:\n${domSnapshot}\n\nHigh-level steps:\n${JSON.stringify(
          steps.map((s) => ({ step: s.step, rawText: s.rawText })),
          null,
          2
        )}`,
      },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Locator API failed: ${response.status} ${text}`);
  }

  let assistantContent = (
    await response.json()
  ).choices[0].message.content.trim();
  assistantContent = assistantContent
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let locatedArray;
  try {
    locatedArray = JSON.parse(assistantContent);
  } catch (e) {
    console.error("Failed to parse locator JSON:", e, assistantContent);
    throw e;
  }

  return steps.map((step) => {
    const found = locatedArray.find((o) => o.step === step.step) || {};
    return {
      ...step,
      elementName: found.elementName || step.rawText,
      selector: found.selector || "",
      xpath: found.xpath || "",
    };
  });
}

// Update the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startGuide") {
    const summaryText = message.summaryText || "";
    const promptText = message.prompt;
    console.log(
      "📢 Content.js starting two-phase workflow; prompt:",
      promptText
    );
    console.log("📝 SummaryText:", summaryText);

    (async () => {
      try {
        // PHASE 1: parse summary → high-level steps
        let steps = parseSummaryIntoSteps(summaryText);
        console.log("▶️ Parsed high-level steps:", steps);

        // PHASE 2: locate each step's element in the DOM
        steps = await locateElementsForSteps(steps);
        console.log("🔍 Located selectors/xpaths:", steps);

        allSteps = steps; // store globally for Intro.js
        showIntroJsGuidance(steps); // your existing function to launch Intro.js
        sendResponse({ success: true });
      } catch (err) {
        console.error("❌ Two-phase guide failed:", err);
        showError("Error: " + err.message); // your existing UI helper
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // keep messaging channel open
  }

  if (message.action === "stopGuide") {
    stopGuide();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "resumeGuide") {
    console.log(`🔄 Resuming guide at step ${message.currentIndex}`);
    showGuidance(message.steps)
      .then(() => {
        if (window.introJs) {
          introJs().goToStep(message.currentIndex);
        }
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("❌ Error resuming guide:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for the async response
  }

  if (message.action === "error") {
    showError(message.message);
    // No response needed for error messages
    return false;
  }

  if (message.action === "showGuidance") {
    showGuidance(message.steps)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("❌ Error showing guidance:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === "showNextStep") {
    if (window.introJs) {
      introJs().goToStep(message.step);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Intro.js not initialized" });
    }
    return true;
  }

  if (message.action === "startManualGuide") {
    // This handler is now in Canva.js
    return false;
  }

  // Persist guide state to chrome.storage
  function persistGuideState(steps, currentIndex) {
    console.log(
      `📝 Persisting guide state: step ${currentIndex} of ${steps.length} steps`
    );
    // Fire-and-forget message, no response needed
    chrome.runtime.sendMessage({
      action: "persistGuideState",
      state: { steps, currentIndex },
    });
  }

  // Start the guidance process
  async function startGuide(prompt, url) {
    try {
      console.log("🔄 Starting guide with prompt:", prompt);
      // Clear any existing guide
      stopGuide();

      // Get a snapshot of the current DOM
      const domSnapshot = serializeDom();

      // Send to background script for analysis
      const response = await chrome.runtime.sendMessage({
        action: "analyzeDom",
        domSnapshot: domSnapshot,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || "Failed to analyze DOM");
      }

      const { steps } = response;
      allSteps = steps;
      await showGuidance(steps);

      return { success: true };
    } catch (error) {
      console.error("❌ Error starting guide:", error);
      showError("Error: " + error.message);
      throw error;
    }
  }

  // Stop the guidance and clean up
  function stopGuide() {
    console.log("🔄 Stopping guide");
    // Reset state
    currentStepElement = null;
    currentStepNumber = 0;
    allSteps = [];
    // Stop Intro.js if it's running
    if (window.introJs) {
      try {
        window.introJs().exit();
      } catch (e) {
        console.log("Note: No active Intro.js tour to exit");
      }
    }
  }

  // Show guidance pages
  async function showGuidance(steps) {
    try {
      await loadIntroJs(); // Make sure this completes
      showIntroJsGuidance(steps);
    } catch (error) {
      console.error("❌ Failed to load Intro.js:", error);
      showError("Error: Failed to load tour interface");
      throw error; // Propagate the error
    }
  }

  function showIntroJsGuidance(steps) {
    console.log("🔍 Attempting to create Intro.js tour with steps:", steps);

    // Map each step to an Intro.js configuration, keeping all original logging
    const introSteps = steps
      .map((step) => {
        console.log(`🔍 Looking for element with selector: ${step.selector}`);
        const element = document.querySelector(step.selector);

        if (!element) {
          console.warn(
            `⚠️ Element not found for step ${step.step}: ${step.elementName}`
          );
          console.warn(`Failed selector: ${step.selector}`);

          // Debug helpers
          console.log(
            "Available compose buttons:",
            document.querySelectorAll('[aria-label*="Compose"]')
          );
          console.log(
            "Available role=button elements:",
            document.querySelectorAll('[role="button"]')
          );
          return null;
        } else {
          console.log(`✅ Found element for step ${step.step}`);
        }

        return {
          element: element,
          intro: `<strong>Step ${step.step}: ${step.elementName}</strong><br>${step.description}`,
          position: "auto",
        };
      })
      .filter((step) => step !== null);

    console.log(
      `📊 Successfully mapped ${introSteps.length} out of ${steps.length} steps`
    );

    const tour = introJs();
    tour.setOptions({
      steps: introSteps,
      showBullets: true,
      showProgress: true,
      highlightClass: "introjs-red-highlight",
      exitOnOverlayClick: false,
      disableInteraction: false,
      scrollToElement: true,
    });

    // Persist state on each step change
    tour.onchange(function (targetElement) {
      const currentIndex = tour._currentStep;
      const currentStepNumber = steps[currentIndex].step;
      console.log(`✅ User moved to step ${currentStepNumber}`);
      persistGuideState(steps, currentIndex);
    });

    // Auto-advance when the user actually clicks the highlighted element
    steps.forEach((step, idx) => {
      const el = document.querySelector(step.selector);
      if (el) {
        el.addEventListener(
          "click",
          () => {
            if (tour._currentStep < introSteps.length - 1) {
              tour.next();
            }
          },
          { once: true }
        );
      }
    });

    // On complete: show success, clear stored state, and notify background
    tour.oncomplete(function () {
      console.log("✅ Tour completed");
      showSuccessMessage("Task completed successfully!");
      chrome.runtime.sendMessage({ action: "stopGuide" });
      chrome.runtime.sendMessage({ action: "guideEnded" });
    });

    // On exit: clear stored state and notify background
    tour.onexit(function () {
      console.log("🔄 Tour exited");
      chrome.runtime.sendMessage({ action: "stopGuide" });
      chrome.runtime.sendMessage({ action: "guideEnded" });
    });

    // Start the tour and persist initial state
    tour.start();
    persistGuideState(steps, 0);
  }

  // If you have other actions, handle them here and return true.
  // Otherwise let other listeners handle it:
  return false;
});
