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

// Log when content script loads
console.log("🔄 Content script loaded");

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

// Main guidance dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`📨 Content script received message: ${message.action}`);

  if (message.action === "startGuide") {
    startGuide(message.prompt)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error("❌ Error starting guide:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for the async response
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
});

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
async function startGuide(prompt) {
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

// Uses Intro.js for multi-step tours
function showIntroJsGuidance(steps) {
  console.log("🔍 Attempting to create Intro.js tour with steps:", steps);

  const introSteps = steps
    .map((step) => {
      console.log(`🔍 Looking for element with selector: ${step.selector}`);

      const element = document.querySelector(step.selector);

      if (!element) {
        console.warn(
          `⚠️ Element not found for step ${step.step}: ${step.element}`
        );
        console.warn(`Failed selector: ${step.selector}`);

        // Let's see what elements ARE available that might match
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
        intro: `<strong>Step ${step.step}: ${step.element}</strong><br>${step.description}`,
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

  tour.onchange(function (targetElement) {
    const currentIndex = tour._currentStep;
    currentStepElement = targetElement;
    currentStepNumber = steps[currentIndex].step;
    console.log(`✅ User moved to step ${currentStepNumber}`);
    persistGuideState(steps, currentIndex);
  });

  tour.oncomplete(function () {
    console.log("✅ Tour completed");
    showSuccessMessage("Task completed successfully!");
  });

  tour.onexit(function () {
    console.log("🔄 Tour exited");
  });

  // Start the tour
  tour.start();
  persistGuideState(steps, 0);
}
