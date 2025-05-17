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

  // ★ Replace with your own key ★
  const OPENAI_API_KEY =
    "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";

  // Load and cache the task manifest JSON (Canva.json)
  let CanvaTasks = null;
  async function loadTasks() {
    if (!CanvaTasks) {
      const url = chrome.runtime.getURL("Canva.json");
      console.log("📥 Fetching Canva.json from:", url);
      const res = await fetch(url);
      if (!res.ok) {
        console.error("❌ Couldn't fetch Canva.json:", res.status);
        throw new Error(`Failed to load task manifest: ${res.status}`);
      }
      CanvaTasks = await res.json();
      console.log("✅ Loaded CanvaTasks:", CanvaTasks);
    }
    return CanvaTasks;
  }

  // Parse freeform user prompt into a task key
  async function parseUserPrompt(promptText) {
    console.log("🔍 Parsing user prompt:", promptText);
    const { tasks } = await loadTasks();
    const listing = tasks.map((t) => `- ${t.key}: ${t.description}`).join("\n");
    const systemPrompt = `You are a classifier for Canva automation tasks.\nAvailable tasks:\n${listing}`;
    const userPrompt = `User request: "${promptText}"\nRespond with the single best task key exactly.`;

    console.log("🤖 Sending to OpenAI:", { systemPrompt, userPrompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("❌ OpenAI parse error:", err);
      throw new Error(`OpenAI parse error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const key = data.choices[0].message.content
      .trim()
      .replace(/^['"\s]+|['"\s]+$/g, "");
    console.log("🔑 OpenAI chose key:", key);
    return key;
  }

  // Apply instruction by dispatching real mouse events
  function applyInstruction(instruction) {
    console.log("🎨 Applying instruction:", instruction);
    const { selectors, action = "click" } = instruction;

    // Find the first matching element
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) {
        console.log("⚠️ No element found for selector:", sel);
        continue;
      }

      console.log("✅ Found element:", sel);

      if (action === "click") {
        // Simulate a real user click with both PointerEvent and MouseEvent
        el.focus();
        // Dispatch both PointerEvent and MouseEvent to satisfy all layers
        ["pointerdown", "pointerup", "mousedown", "mouseup"].forEach((type) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window,
            })
          )
        );
        // Invoke the native click method, which React will always see
        el.click();
        console.log("🖱️ Real click() invoked on", el);
        return true;
      }

      if (action === "sequence") {
        // Same pattern on the second selector
        console.log("🔄 Starting sequence click");
        el.focus();
        ["pointerdown", "pointerup", "mousedown", "mouseup"].forEach((type) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window,
            })
          )
        );
        el.click();
        setTimeout(() => {
          const next = document.querySelector(instruction.selectors[1]);
          if (next) {
            console.log("🖱️ Clicking next element in sequence");
            next.focus();
            ["pointerdown", "pointerup", "mousedown", "mouseup"].forEach(
              (type) =>
                next.dispatchEvent(
                  new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window,
                  })
                )
            );
            next.click();
          } else {
            console.warn("⚠️ No element found for second selector in sequence");
          }
        }, 200);
        return true;
      }
    }

    console.warn("⚠️ No element matched selectors:", selectors);
    return false;
  }

  // High-level: perform by key using static task manifest
  async function performCanvaTask(key, params = {}) {
    try {
      const { tasks } = await loadTasks();
      const task = tasks.find((t) => t.key === key);
      if (!task) {
        console.error("❌ Unknown task key:", key);
        throw new Error(`Unknown task key: ${key}`);
      }
      // task.selectors and task.action come straight from Canva.json
      return applyInstruction({
        selectors: task.selectors,
        action: task.action,
      });
    } catch (e) {
      console.error("❌ performCanvaTask error:", e);
      return false;
    }
  }

  // Expose the API
  const api = {
    async runCanvaPrompt(prompt, params = {}) {
      const key = await parseUserPrompt(prompt);
      const success = await performCanvaTask(key, params);
      return [key, params];
    },
    async runCanvaTask(key, params = {}) {
      return performCanvaTask(key, params);
    },
  };

  // Wire up the message listener
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("📥 Received message in Canva.js:", msg);

    if (msg.action === "runCanvaPrompt") {
      api
        .runCanvaPrompt(msg.prompt, msg.params)
        .then(([key, params]) => {
          console.log("✅ runCanvaPrompt completed:", { key, params });
          sendResponse({ success: true, key, params });
        })
        .catch((err) => {
          console.error("❌ runCanvaPrompt failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep the message channel open
    }

    if (msg.action === "runCanvaTask") {
      // ─── TEXT-FORMAT SPECIALS ──────────────────────────────
      if (msg.key === "boldText" || msg.key === "italicText") {
        // 1. Ensure there is a text selection
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.toString().trim()) {
          console.warn("⚠️ No text selected");
          sendResponse({ success: false, error: "No text selected" });
          return true;
        }

        // 2. Apply formatting via execCommand
        try {
          const command = msg.key === "boldText" ? "bold" : "italic";
          console.log("🎨 Applying format:", command);

          // Try in main document first
          document.execCommand(command);

          // If that didn't work, try in any iframes
          const iframes = document.querySelectorAll("iframe");
          for (const iframe of iframes) {
            try {
              iframe.contentDocument.execCommand(command);
            } catch (e) {
              console.log("⚠️ Could not execute command in iframe:", e);
            }
          }

          console.log("✅ Format applied successfully");
          sendResponse({ success: true });
        } catch (err) {
          console.error("❌ Error applying format:", err);
          sendResponse({ success: false, error: err.message });
        }
        return true;
      }

      // ─── ALIGN SPECIAL CASE ────────────────────────────────
      if (["alignLeft", "alignCenter", "alignRight"].includes(msg.key)) {
        const btn = document.querySelector(
          "button[aria-label^='Toggle text alignment, current alignment:']"
        );
        if (!btn) {
          console.error("⚠️ Align button not found");
          sendResponse({ success: false, error: "No align control" });
          return true;
        }

        // parse current alignment
        const label = btn.getAttribute("aria-label");
        const m = /current alignment:\s*(\w+)/i.exec(label);
        const current = m ? m[1] : null;
        const desired =
          msg.key === "alignLeft"
            ? "Left"
            : msg.key === "alignCenter"
            ? "Center"
            : "Right";
        const order = ["Left", "Center", "Right"];
        const idxCur = order.indexOf(current);
        const idxDes = order.indexOf(desired);
        // how many presses?
        const presses =
          idxCur >= 0
            ? (idxDes - idxCur + order.length) % order.length
            : idxDes + 1;

        console.log("🎨 Aligning text:", {
          current,
          desired,
          presses,
          label,
        });

        // simulated clicks
        for (let i = 0; i < presses; i++) {
          ["pointerdown", "pointerup", "mousedown", "mouseup"].forEach((t) =>
            btn.dispatchEvent(
              new PointerEvent(t, {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
              })
            )
          );
          btn.click();
        }

        sendResponse({ success: true });
        return true;
      }

      // ─── FALLBACK TO GENERIC TASKS ─────────────────────────
      api
        .runCanvaTask(msg.key, msg.params)
        .then((success) => {
          console.log("✅ runCanvaTask completed:", success);
          sendResponse({ success, key: msg.key });
        })
        .catch((err) => {
          console.error("❌ runCanvaTask failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep the message channel open
    }
  });
})();
