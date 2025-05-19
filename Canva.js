// canva-integration.js
(function () {
  console.log("🚀 Canva.js content script starting...");

  // Guard against running on non-Canva domains
  if (!location.hostname.includes("canva.com")) {
    console.log(
      "🔄 Canva integration disabled on non-Canva domain:",
      location.hostname
    );
    return;
  }
  console.log("✅ Running on Canva domain:", location.hostname);

  let manualIntro = null;
  let manualHost = null;

  // ─── Inject Intro.js CSS (bundled or fall back to CDN) ─────────────
  (function injectIntroCss() {
    const introCss = document.createElement("link");
    introCss.rel = "stylesheet";
    introCss.href = chrome.runtime.getURL("introjs.min.css");
    introCss.onerror = () => {
      // fallback if local CSS isn't available
      const cdn = document.createElement("link");
      cdn.rel = "stylesheet";
      cdn.href = "https://unpkg.com/intro.js/minified/introjs.min.css";
      document.head.appendChild(cdn);
    };
    document.head.appendChild(introCss);

    // Load the auto-positioning plugin into the Canva page
    const autoPos = document.createElement("script");
    autoPos.src = chrome.runtime.getURL("introjs-auto-positioning.js");
    document.head.appendChild(autoPos);
  })();

  // ─── Inject custom styles for tooltip & buttons ───────────
  const customCss = document.createElement("style");
  customCss.textContent = `
    /* Allow clicks to pass through the overlay hole to the real page element */
    .introjs-helperLayer {
      pointer-events: none !important;
      background-color: rgba(0,0,0,0.4) !important;
    }
    /* If you see a separate overlay class, you can add that too */
    .introjs-overlay {
      pointer-events: none !important;
    }

    .introjs-tooltip {
      background: #1e1e1e;    /* dark panel */
      color: #ddd;           /* light text */
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: "Helvetica Neue", Arial, sans-serif;

      /* force a constant width, but still clamp on tiny viewports */
      width: 280px !important;
      max-width: calc(100vw - 40px) !important;
      box-sizing: border-box !important;
      white-space: normal !important;   /* wrap long lines */
      position: absolute !important;    /* let Intro.js position relative to target */
      max-height: calc(100vh - 40px) !important;/* never taller than viewport–40px */
      overflow-wrap: break-word !important;     /* wrap long words */
    }
    .introjs-tooltipbuttons {
      margin-top: 8px;
      text-align: right;
    }
    .introjs-nextbutton, .introjs-donebutton {
      background: #0e639c;   /* match your "Go" button */
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
    }
    /* make the highlight pop */
    .introjs-red-highlight {
      box-shadow: 0 0 0 4px rgba(26, 115, 232, 0.6) !important;
    }
    /* Let Intro.js tooltips & buttons catch clicks */
    #chiron-intro-host {
      pointer-events: none !important;
    }
    .introjs-tooltip,
    .introjs-tooltip * {
      pointer-events: auto !important;
    }
    /* make space at bottom of tooltip for our hint */
    .chiron-tooltip {
      position: relative;
      padding-bottom: 28px;    /* room for the hint */
    }

    /* style and position the hint */
    .chiron-tooltip .esc-hint {
      position: absolute;
      bottom: 8px;             /* 8px up from tooltip's bottom edge */
      left: 0; right: 0;       /* full width */
      text-align: center;      /* center the text */
      font-size: 12px;         /* smaller than body text */
      color: #aaa;             /* slightly muted */
      pointer-events: none;    /* don't intercept clicks */
    }
  `;
  document.head.appendChild(customCss);

  // Load only manualGuides from JSON
  let manualGuides = [];
  fetch(chrome.runtime.getURL("Canva.json"))
    .then((res) => res.json())
    .then((cfg) => {
      manualGuides = cfg.manualGuides || [];
    })
    .catch((err) => console.error("Failed to load Canva.json:", err));

  // Handle messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "startManualGuide") {
      console.log("▶️ startManualGuide for key:", msg.key);
      const guide = manualGuides.find((g) => g.key === msg.key);
      if (!guide) {
        console.error("❌ No guide defined for", msg.key);
        sendResponse({ success: false, error: "No guide defined" });
        return true;
      }

      // pick the first step's selector as our entry point
      const first =
        guide.steps && guide.steps.length
          ? guide.steps[0]
          : {
              selector: guide.selector,
              intro: guide.intro,
              position: guide.position,
            };
      let el = null;
      for (const sel of first.selector.split(",").map((s) => s.trim())) {
        el = document.querySelector(sel);
        if (el) break;
      }
      if (!el) {
        console.error("❌ Element not found for selector:", first.selector);
        sendResponse({ success: false, error: "Element not found" });
        return true;
      }

      // Create a top-level host with a super-high z-index
      manualHost = document.createElement("div");
      manualHost.id = "chiron-intro-host";
      Object.assign(manualHost.style, {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none", // let clicks pass through to Intro.js
        zIndex: String(2 ** 31 - 1),
      });
      document.body.appendChild(manualHost);

      // Make host focusable and give it focus
      manualHost.tabIndex = -1;
      manualHost.focus();

      // create a permanent Intro.js instance
      manualIntro = introJs();

      // build step array (uses guide.steps if present, otherwise fall back)
      const raw = guide.steps || [first];

      // Constants for tooltip positioning
      const TOOLTIP_WIDTH = 280;
      const HORIZONTAL_MARGIN = 20;

      // Add dynamic position adjustment for older Intro.js versions
      const steps = raw.map((s) => {
        let element = null;
        for (const sel of s.selector.split(",").map((x) => x.trim())) {
          element = document.querySelector(sel);
          if (element) break;
        }

        // If we found the element, check its position for dynamic adjustment
        if (element) {
          const rect = element.getBoundingClientRect();

          // if there's not enough room on the right → show on left
          if (
            rect.right + TOOLTIP_WIDTH + HORIZONTAL_MARGIN >
            window.innerWidth
          ) {
            s.position = "left";
          }
          // if there's not enough room on the left → show on right
          else if (rect.left - TOOLTIP_WIDTH - HORIZONTAL_MARGIN < 0) {
            s.position = "right";
          }
          // otherwise let Intro.js pick top/bottom or your "auto"
          else {
            s.position = "auto";
          }
        }

        return {
          element,
          intro: `${s.intro}<div class="esc-hint">Press Esc to exit</div>`,
          position: s.position,
          // only hide buttons when we're waiting for a click
          showButtons: !s.waitFor,
        };
      });

      manualIntro.setOptions({
        steps,
        showBullets: false,
        showButtons: true, // enable buttons by default
        showStepNumbers: true,
        nextLabel: "Next", // clearer than "OK"
        doneLabel: "Finish",
        exitOnOverlayClick: false,
        disableInteraction: false, // allow clicks on highlighted elements
        scrollToElement: true,
        autoRefresh: true,
        tooltipClass: "chiron-tooltip",
        highlightClass: "introjs-red-highlight",
        exitOnEsc: true,
        keyboardNavigation: false, // disable keyboard nav since we're click-based
      });

      // Listen for step changes to handle click-based progression
      manualIntro.onafterchange((targetEl) => {
        const stepIdx = manualIntro._currentStep;
        const stepDef = raw[stepIdx];

        // if this step says "waitFor: click", wire up a one-time click → nextStep
        if (stepDef.waitFor === "click" && targetEl) {
          const onClick = () => {
            targetEl.removeEventListener("click", onClick);
            manualIntro.nextStep();
          };
          targetEl.addEventListener("click", onClick, { once: true });
        }
      });

      // Listen for Escape key to exit the guide
      const escListener = (e) => {
        if (e.key === "Escape") {
          manualIntro.exit();
        }
      };
      document.addEventListener("keydown", escListener);

      // only refresh if the tour is active, and remove listeners on exit
      const refreshListener = () => {
        if (manualIntro) manualIntro.refresh();
      };
      window.addEventListener("resize", refreshListener);
      window.addEventListener("scroll", refreshListener);

      // start the guide
      manualIntro.start();

      manualIntro.onexit(() => {
        window.removeEventListener("resize", refreshListener);
        window.removeEventListener("scroll", refreshListener);
        document.removeEventListener("keydown", escListener);
        chrome.runtime.sendMessage({ action: "manualGuideExited" });

        // ← fully tear down the host so Esc actually frees your UI
        if (manualHost && manualHost.parentNode) {
          manualHost.remove();
          manualHost = null;
        }
        manualIntro = null;
      });
      manualIntro.oncomplete(() => {
        window.removeEventListener("resize", refreshListener);
        window.removeEventListener("scroll", refreshListener);
        document.removeEventListener("keydown", escListener);
        chrome.runtime.sendMessage({ action: "manualGuideExited" });

        if (manualHost && manualHost.parentNode) {
          manualHost.remove();
          manualHost = null;
        }
        manualIntro = null;
      });
      sendResponse({ success: true });
      return true;
    }

    // ─── Listen for stopGuide and tear down the manual guide ────────────
    if (msg.action === "stopGuide") {
      console.log("📢 Canva.js got stopGuide ➞ exiting manual guide");
      if (manualIntro) {
        try {
          manualIntro.exit();
        } catch {}
        manualIntro = null;
      }
      if (manualHost && manualHost.parentNode) {
        manualHost.remove();
        manualHost = null;
      }
      sendResponse({ success: true });
      return true;
    }

    return false;
  });
})();
