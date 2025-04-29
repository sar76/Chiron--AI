// content.js

let activeOverlays = [];
let currentStepElement = null;
let currentStepNumber = 0;
let allSteps = [];
let errorOverlay = null;
let introJs = null; // Will store the Intro.js instance if using a library approach

// Log when content script loads
console.log("🔄 Content script loaded");

// Dynamically load Intro.js library
function loadIntroJs() {
  return new Promise((resolve, reject) => {
    // Check if Intro.js is already loaded
    if (window.introJs) {
      console.log("✅ Intro.js already loaded");
      resolve(window.introJs);
      return;
    }

    console.log("🔄 Loading Intro.js...");
    
    // Load CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://cdn.jsdelivr.net/npm/intro.js@7.0.1/introjs.min.css';
    document.head.appendChild(cssLink);
    
    // Load JavaScript
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/intro.js@7.0.1/intro.min.js';
    script.onload = () => {
      console.log("✅ Intro.js loaded successfully");
      resolve(window.introJs);
    };
    script.onerror = (error) => {
      console.error("❌ Failed to load Intro.js:", error);
      reject(error);
    };
    document.head.appendChild(script);
  });
}

// Load custom CSS for our overlays
function loadCustomStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .guide-overlay {
      position: absolute;
      z-index: 999999;
      border: 2px solid red;
      border-radius: 3px;
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
      pointer-events: none;
      transition: all 0.3s ease;
    }
    
    .guide-step-badge {
      position: absolute;
      top: -25px;
      left: 0;
      background-color: red;
      color: white;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      white-space: nowrap;
      z-index: 1000000;
    }

    .guide-tooltip {
      position: absolute;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
      max-width: 300px;
      z-index: 1000001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
    }

    .guide-next-button {
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 5px 10px;
      margin-top: 10px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }

    .guide-next-button:hover {
      background-color: #3b78e7;
    }
    
    /* Custom style for Intro.js highlights */
    .introjs-helperLayer {
      border: 2px solid red !important;
      box-shadow: 0 0 0 1000px rgba(0, 0, 0, .5), 0 0 10px rgba(255, 0, 0, 0.5) !important;
    }
  `;
  document.head.appendChild(style);
}

// Listen for commands from background (or popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`📨 Content script received message: ${message.action}`);
  
  if (message.action === "startGuide") {
    startGuide(message.prompt).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
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
  
  if (message.action === "showGuidance") {
    showGuidance(message.steps);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === "showNextStep") {
    showNextStep(message.step);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === "error") {
    showError(message.message);
    sendResponse({ success: true });
    return true;
  }
});

function showError(message) {
  // Remove existing error overlay if any
  if (errorOverlay) {
    errorOverlay.remove();
  }
  
  // Create new error overlay
  errorOverlay = document.createElement("div");
  errorOverlay.style.position = "fixed";
  errorOverlay.style.top = "20px";
  errorOverlay.style.left = "50%";
  errorOverlay.style.transform = "translateX(-50%)";
  errorOverlay.style.padding = "10px 20px";
  errorOverlay.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
  errorOverlay.style.color = "white";
  errorOverlay.style.borderRadius = "5px";
  errorOverlay.style.zIndex = "1000000";
  errorOverlay.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  errorOverlay.textContent = message;
  
  document.body.appendChild(errorOverlay);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (errorOverlay) {
      errorOverlay.remove();
      errorOverlay = null;
    }
  }, 5000);
}

// Start the guidance process
async function startGuide(prompt) {
  try {
    console.log("🔄 Starting guide with prompt:", prompt);
    
    // Clear any existing guide
    stopGuide();
    
    // Load custom styles
    loadCustomStyles();
    
    // Get a snapshot of the current DOM
    const domSnapshot = serializeDom();
    
    // Send to background script for analysis
    chrome.runtime.sendMessage({ 
      action: "analyzeDom", 
      domSnapshot: domSnapshot 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error sending message:", chrome.runtime.lastError);
        showError("Error: Failed to communicate with the extension.");
      } else if (response && response.success) {
        console.log("✅ DOM analysis complete, steps received:", response.steps);
        // Steps will be processed by the showGuidance handler
      } else {
        console.error("❌ Error from background script:", response?.error || "Unknown error");
        showError("Error: " + (response?.error || "Failed to analyze the page."));
      }
    });
  } catch (error) {
    console.error("❌ Error starting guide:", error);
    showError("Error: " + error.message);
    throw error;
  }
}

// Stop the guidance and clean up
function stopGuide() {
  console.log("🔄 Stopping guide");
  
  // Clear all overlays
  clearHighlights();
  
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

// Process and display guidance steps
async function showGuidance(steps) {
  // Store all steps for reference
  allSteps = steps;
  
  // Decide whether to use Intro.js or our custom highlighting
  const useIntroJs = steps.length > 1;
  
  if (useIntroJs) {
    // Use Intro.js for multi-step guidance
    try {
      introJs = await loadIntroJs();
      showIntroJsGuidance(steps);
    } catch (error) {
      console.error("❌ Failed to load Intro.js, falling back to custom highlights:", error);
      // Fallback to custom highlighting if Intro.js fails
      showCustomGuidance(steps);
    }
  } else {
    // Use custom highlighting for single-step guidance
    showCustomGuidance(steps);
  }
}

// Use Intro.js for a polished guided tour
function showIntroJsGuidance(steps) {
  // Convert our steps to Intro.js format
  const introSteps = steps.map(step => {
    // Try to find the element
    const element = findElementBySelectors(step);
    if (!element) {
      console.warn(`⚠️ Element not found for step ${step.step}: ${step.element}`);
      return null;
    }
    
    return {
      element: element,
      intro: `<strong>Step ${step.step}: ${step.element}</strong><br>${step.description}`,
      position: determineTooltipPosition(element)
    };
  }).filter(step => step !== null);
  
  if (introSteps.length === 0) {
    showError("Error: Could not find any elements to highlight.");
    return;
  }
  
  // Configure and start the tour
  const tour = introJs();
  tour.setOptions({
    steps: introSteps,
    showBullets: true,
    showProgress: true,
    highlightClass: 'introjs-red-highlight',
    exitOnOverlayClick: false,
    disableInteraction: false,
    scrollToElement: true
  });
  
  // Handle step changes
  tour.onchange(function(targetElement) {
    const currentIndex = tour._currentStep;
    currentStepElement = targetElement;
    currentStepNumber = steps[currentIndex].step;
    console.log(`✅ User moved to step ${currentStepNumber}`);
  });
  
  // Handle tour completion
  tour.oncomplete(function() {
    console.log("✅ Tour completed");
    showSuccessMessage("Task completed successfully!");
  });
  
  // Handle tour exit
  tour.onexit(function() {
    console.log("🔄 Tour exited");
  });
  
  // Start the tour
  tour.start();
}

// Use custom highlighting for simpler guidance
function showCustomGuidance(steps) {
  if (steps.length === 0) {
    showError("Error: No steps provided for guidance.");
    return;
  }
  
  // Start with the first step
  const firstStep = steps[0];
  showStep(firstStep);
}

// Show a single step
function showStep(stepInfo) {
  // Find the element
  const element = findElementBySelectors(stepInfo);
  if (!element) {
    console.warn(`⚠️ Element not found for step ${stepInfo.step}: ${stepInfo.element}`);
    showError(`Error: Could not find the element for step ${stepInfo.step}.`);
    return;
  }
  
  // Track current step
  currentStepElement = element;
  currentStepNumber = stepInfo.step;
  
  // Highlight the element
  highlightElement(element, stepInfo);
  
  // Add click listener to detect completion
  addStepCompletionListener(element, stepInfo);
}

// Show the next step in the sequence
function showNextStep(stepInfo) {
  // Clear previous highlights
  clearHighlights();
  
  // Show the new step
  showStep(stepInfo);
}

// Create a highlight overlay for an element
function highlightElement(element, stepInfo) {
  // Get element position accounting for scroll
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "guide-overlay";
  overlay.style.left = `${rect.left + scrollX}px`;
  overlay.style.top = `${rect.top + scrollY}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  
  // Add step badge
  const badge = document.createElement("div");
  badge.className = "guide-step-badge";
  badge.textContent = `Step ${stepInfo.step}: ${stepInfo.element}`;
  overlay.appendChild(badge);
  
  // Add tooltip with description
  const tooltip = document.createElement("div");
  tooltip.className = "guide-tooltip";
  tooltip.innerHTML = `<strong>${stepInfo.description}</strong>`;
  
  // Add action instruction
  let actionText = "";
  switch (stepInfo.action.toLowerCase()) {
    case "click":
      actionText = "Click this element";
      break;
    case "type":
      actionText = "Type into this field";
      break;
    case "select":
      actionText = "Select an option from this dropdown";
      break;
    default:
      actionText = `${stepInfo.action} this element`;
  }
  tooltip.innerHTML += `<p>${actionText}</p>`;
  
  // Position tooltip based on available space
  const position = determineTooltipPosition(element);
  
  switch (position) {
    case "top":
      tooltip.style.bottom = `${window.innerHeight - (rect.top + scrollY) + 10}px`;
      tooltip.style.left = `${rect.left + scrollX + (rect.width / 2) - 150}px`;
      break;
    case "bottom":
      tooltip.style.top = `${rect.bottom + scrollY + 10}px`;
      tooltip.style.left = `${rect.left + scrollX + (rect.width / 2) - 150}px`;
      break;
    case "left":
      tooltip.style.top = `${rect.top + scrollY + (rect.height / 2) - 50}px`;
      tooltip.style.right = `${window.innerWidth - (rect.left + scrollX) + 10}px`;
      break;
    case "right":
      tooltip.style.top = `${rect.top + scrollY + (rect.height / 2) - 50}px`;
      tooltip.style.left = `${rect.right + scrollX + 10}px`;
      break;
  }
  
  // Add manual next button
  const nextButton = document.createElement("button");
  nextButton.className = "guide-next-button";
  nextButton.textContent = "I've Completed This Step";
  nextButton.addEventListener("click", () => {
    handleStepCompleted();
  });
  tooltip.appendChild(nextButton);
  
  // Add to page
  document.body.appendChild(overlay);
  document.body.appendChild(tooltip);
  
  // Store for later cleanup
  activeOverlays.push(overlay);
  activeOverlays.push(tooltip);
  
  // Scroll element into view if needed
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

// Add event listeners to detect when a step is completed
function addStepCompletionListener(element, stepInfo) {
  // Different handling based on action type
  switch (stepInfo.action.toLowerCase()) {
    case "click":
      // Listen for clicks on the element
      element.addEventListener("click", handleStepCompleted, { once: true });
      break;
      
    case "type":
      // For input fields, listen for input and enter key
      element.addEventListener("input", () => {
        // Don't complete on input alone - wait for enter or blur
      });
      element.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          handleStepCompleted();
        }
      });
      element.addEventListener("blur", () => {
        // Check if field has a value before considering it complete
        if (element.value.trim()) {
          handleStepCompleted();
        }
      });
      break;
      
    case "select":
      // For select elements, listen for change
      element.addEventListener("change", handleStepCompleted, { once: true });
      break;
      
    default:
      // For other actions, just listen for clicks
      element.addEventListener("click", handleStepCompleted, { once: true });
  }
}

// Handle step completion
function handleStepCompleted() {
  console.log(`✅ User completed step ${currentStepNumber}`);
  
  // Wait a moment for any page changes to settle
  setTimeout(() => {
    // Check if we have more steps in our cached sequence
    if (allSteps.length > currentStepNumber) {
      // Move to the next step in our cached sequence
      const nextStep = allSteps.find(step => step.step === currentStepNumber + 1);
      if (nextStep) {
        showNextStep(nextStep);
        return;
      }
    }
    
    // If we don't have the next step cached, get a fresh DOM snapshot and ask for the next step
    const domSnapshot = serializeDom();
    
    // Send to background script for next step
    chrome.runtime.sendMessage({
      action: "getNextStep",
      currentStep: currentStepNumber,
      domSnapshot: domSnapshot
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error sending message:", chrome.runtime.lastError);
        showError("Error: Failed to communicate with the extension.");
      } else if (response && response.success) {
        console.log("✅ Next step received:", response.step);
        // Show the next step
        showNextStep(response.step);
      } else {
        console.error("❌ Error from background script:", response?.error || "Unknown error");
        showError("Error: " + (response?.error || "Failed to determine the next step."));
      }
    });
  }, 1000); // Small delay to allow page to update
}

// Find DOM element using selectors from step info
function findElementBySelectors(stepInfo) {
  let element = null;
  
  // Try CSS selector first
  if (stepInfo.selector) {
    try {
      element = document.querySelector(stepInfo.selector);
      if (element) {
        console.log(`✅ Found element using CSS selector: ${stepInfo.selector}`);
        return element;
      }
    } catch (error) {
      console.warn(`⚠️ Invalid CSS selector: ${stepInfo.selector}`, error);
    }
  }
  
  // Try XPath next
  if (stepInfo.xpath) {
    try {
      const result = document.evaluate(
        stepInfo.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      if (result && result.singleNodeValue) {
        console.log(`✅ Found element using XPath: ${stepInfo.xpath}`);
        return result.singleNodeValue;
      }
    } catch (error) {
      console.warn(`⚠️ Invalid XPath: ${stepInfo.xpath}`, error);
    }
  }
  
  // Try to find by text content
  if (stepInfo.text) {
    // Look for elements with matching text
    const allElements = document.querySelectorAll('a, button, input, select, [role="button"]');
    for (const el of allElements) {
      const text = el.textContent?.trim() || el.value || el.placeholder || '';
      if (text.includes(stepInfo.text)) {
        console.log(`✅ Found element by text content: ${stepInfo.text}`);
        return el;
      }
      
      // Check for aria-label and title attributes too
      const ariaLabel = el.getAttribute('aria-label');
      const title = el.getAttribute('title');
      if (ariaLabel?.includes(stepInfo.text) || title?.includes(stepInfo.text)) {
        console.log(`✅ Found element by aria-label/title: ${stepInfo.text}`);
        return el;
      }
    }
  }
  
  // If still not found, try a more permissive search by element description
  console.warn(`⚠️ Element not found by selectors, trying by description: ${stepInfo.element}`);
  
  const searchTerm = stepInfo.element.toLowerCase();
  const allElements = document.querySelectorAll('a, button, input, select, [role="button"]');
  for (const el of allElements) {
    const text = el.textContent?.trim() || el.value || el.placeholder || '';
    if (text.toLowerCase().includes(searchTerm)) {
      console.log(`✅ Found element by description match: ${searchTerm}`);
      return el;
    }
    
    // Check attributes
    const ariaLabel = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    const id = el.id;
    const className = el.className;
    const name = el.getAttribute('name');
    
    if (
      ariaLabel?.toLowerCase().includes(searchTerm) ||
      title?.toLowerCase().includes(searchTerm) ||
      id?.toLowerCase().includes(searchTerm) ||
      className?.toLowerCase().includes(searchTerm) ||
      name?.toLowerCase().includes(searchTerm)
    ) {
      console.log(`✅ Found element by attribute match: ${searchTerm}`);
      return el;
    }
  }
  
  console.error(`❌ Element not found: ${stepInfo.element}`);
  return null;
}

// Helper to determine the best position for tooltips
function determineTooltipPosition(element) {
  const rect = element.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Calculate available space in each direction
  const spaceTop = rect.top;
  const spaceBottom = windowHeight - rect.bottom;
  const spaceLeft = rect.left;
  const spaceRight = windowWidth - rect.right;
  
  // Find the direction with the most space
  const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
  
  if (maxSpace === spaceTop) return "top";
  if (maxSpace === spaceBottom) return "bottom";
  if (maxSpace === spaceLeft) return "left";
  return "right";
}

// Clear all highlights
function clearHighlights() {
  activeOverlays.forEach(overlay => overlay.remove());
  activeOverlays = [];
}

// Show success message when all steps are completed
function showSuccessMessage(message) {
  const successOverlay = document.createElement("div");
  successOverlay.style.position = "fixed";
  successOverlay.style.top = "20px";
  successOverlay.style.left = "50%";
  successOverlay.style.transform = "translateX(-50%)";
  successOverlay.style.padding = "10px 20px";
  successOverlay.style.backgroundColor = "rgba(46, 204, 113, 0.9)";
  successOverlay.style.color = "white";
  successOverlay.style.borderRadius = "5px";
  successOverlay.style.zIndex = "1000000";
  successOverlay.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  successOverlay.textContent = message;
  
  document.body.appendChild(successOverlay);
  activeOverlays.push(successOverlay);
  
  // Remove after 5 seconds
  setTimeout(() => {
    successOverlay.remove();
    activeOverlays = activeOverlays.filter(o => o !== successOverlay);
  }, 5000);
}

// Serialize DOM to a clean string for analysis
function serializeDom() {
  // Create a simplified version of the DOM
  // Focus on interactive elements to reduce size
  let serialized = [];
  
  // Helper to extract important attributes
  function getAttributes(element) {
    const result = {};
    
    // Most important attributes for interaction
    const attributes = [
      'id', 'class', 'name', 'type', 'role', 'aria-label', 
      'placeholder', 'title', 'href', 'value'
    ];
    
    attributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) result[attr] = value;
    });
    
    return result;
  }
  
  // Helper to extract element data
  function extractElementData(element) {
    return {
      tag: element.tagName.toLowerCase(),
      text: element.textContent.trim().substring(0, 100), // Limit text length
      attributes: getAttributes(element),
      isVisible: isVisibleElement(element)
    };
  }
  
  // Check if element is visible
  function isVisibleElement(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }
  
  // Get all interactive elements
  const interactiveElements = document.querySelectorAll(
    'a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]'
  );
  
  // Process each element
  interactiveElements.forEach(element => {
    if (isVisibleElement(element)) {
      serialized.push(extractElementData(element));
    }
  });
  
  // Add some context elements (headings, labels, etc.)
  const contextElements = document.querySelectorAll('h1, h2, h3, label');
  contextElements.forEach(element => {
    if (isVisibleElement(element)) {
      serialized.push(extractElementData(element));
    }
  });
  
  // Convert to string, but keep it reasonably sized
  return JSON.stringify(serialized).substring(0, 100000);
}