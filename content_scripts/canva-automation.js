// canva-automation.js
(async function () {
  // Load our automation definitions
  const cfg = await fetch(chrome.runtime.getURL("Canva.automation.json")).then(
    (r) => r.json()
  );
  const automations = cfg.automationGuides || [];

  // Wait until an element matching `selector` appears (or timeout)
  function waitFor(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      let elapsed = 0,
        interval = 100;
      const check = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if ((elapsed += interval) >= timeout)
          return reject(new Error(`Timeout: ${selector}`));
        setTimeout(check, interval);
      };
      check();
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Listen for our runCanvaTask command
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action !== "runCanvaTask") return;
    (async () => {
      const task = automations.find((a) => a.key === msg.key);
      if (!task) throw new Error(`No automation found for ${msg.key}`);
      for (const step of task.automationSteps) {
        const el = await waitFor(step.selector);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        await sleep(step.delay || 300);
        if (step.action === "click") el.click();
        await sleep(step.delay || 300);
      }
      sendResponse({ success: true });
    })().catch((err) => {
      console.error("Canva automation error:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // keep the channel open for async sendResponse
  });
})();
