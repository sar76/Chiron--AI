// content.js

// Listen for both HTML‐requests and guide steps
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageHtml") {
    // 1) Return the full page HTML to background
    sendResponse({ html: document.documentElement.outerHTML });
    return true;
  }

  if (message.action === "startGuide") {
    // 2) Run the guide steps
    console.log("Running guide steps:", message.steps);
    const steps = message.steps || [];
    steps.forEach((step, i) => {
      setTimeout(() => performStep(step), i * 800);
    });
    return true;
  }

  if (message.action === "guideError") {
    console.error("Guide error:", message.message);
    return true;
  }
});

function performStep(step) {
  try {
    const el = document.querySelector(step.selector);
    if (!el) {
      console.warn(`No element found for selector: ${step.selector}`);
      return;
    }

    // Scroll into view
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Draw the highlight
    if (step.action === "click") {
      el.style.border = "2px solid red";
      // Optionally uncomment to actually click:
      // el.click();
    } else if (step.action === "highlight") {
      el.style.outline = "3px dashed red";
    }
  } catch (e) {
    console.error("performStep error:", e);
  }
}
