// canva-automation.js
async function runCanvaAutomation(guideKey) {
  try {
    // Load automation configuration
    const cfg = await fetch(
      chrome.runtime.getURL("./Canva.automation.json")
    ).then((r) => r.json());
    const task = cfg.automationGuides.find((a) => a.key === guideKey);

    if (!task) {
      throw new Error(`No automation found for key "${guideKey}"`);
    }

    console.group(`🌟 Running Canva automation for "${guideKey}"`);

    for (const [i, step] of task.automationSteps.entries()) {
      console.log(`— Step ${i + 1}/${task.automationSteps.length}:`, step);

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
            window.getComputedStyle(element).visibility !== "hidden"
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
            console.log(`👉 [Step ${i + 1}] Clicking`, step.selector);
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
              freshEl.dispatchEvent(new Event("input", { bubbles: true }));
              freshEl.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
              freshEl.innerText = text;
              freshEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
              freshEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
            break;

          case "pressEnter":
            console.log(`⏎ [Step ${i + 1}] Pressing Enter on`, step.selector);
            freshEl.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
            );
            freshEl.dispatchEvent(
              new KeyboardEvent("keyup", { key: "Enter", bubbles: true })
            );
            freshEl.dispatchEvent(
              new KeyboardEvent("keypress", { key: "Enter", bubbles: true })
            );
            break;

          default:
            console.warn(`⚠️ [Step ${i + 1}] Unknown action "${step.action}"`);
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
}
