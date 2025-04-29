// background.js

// ★ Replace with your own key ★
const OPENAI_API_KEY = "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";

// Log when background script loads
console.log("🔄 Background script loaded");

// Validate API key on startup
if (!OPENAI_API_KEY || OPENAI_API_KEY === "your-api-key-here") {
  console.error("❌ OpenAI API key is not set or is invalid");
  chrome.runtime.sendMessage({ 
    action: 'error', 
    message: 'OpenAI API key is not configured. Please check your API key.'
  });
} else {
  console.log("✅ API key is set:", OPENAI_API_KEY.substring(0, 10) + "...");
}

let userPrompt = ""; // holds the instructions for this session

// Helper function to send errors to both popup and content script
function sendError(message, details = null) {
  console.error(`❌ Error: ${message}`, details ? `Details: ${details}` : '');
  
  // Send to popup
  chrome.runtime.sendMessage({ 
    action: 'error', 
    message: message,
    details: details
  });
  
  // Send to content script if we have a tab ID
  if (chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'error',
          message: message
        });
      }
    });
  }
}

// Log all incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`📨 Received message: ${message.action}`, message);
  
  // ─── Get stream ID for screen capture ───────────────────────────
  if (message.action === "getStreamId") {
    console.log("🔄 Requesting screen capture stream ID");
    
    // Use chrome.desktopCapture API to get a stream ID
    chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window", "tab"],
      sender.tab,
      (streamId) => {
        console.log("✅ Got stream ID:", streamId);
        sendResponse({ streamId: streamId });
      }
    );
    
    return true; // Keep the message channel open for the async response
  }
  
  // ─── Set or clear the prompt ────────────────────────────────────
  if (message.action === "setPrompt") {
    userPrompt = message.prompt;
    console.log("✅ Prompt set:", userPrompt);
    // Send response back to confirm prompt was set
    sendResponse({ success: true, prompt: userPrompt });
    return true; // Keep the message channel open for the async response
  }
  if (message.action === "clearPrompt") {
    userPrompt = "";
    console.log("✅ Prompt cleared");
    sendResponse({ success: true });
    return true;
  }

  // ─── Analyze a captured frame ──────────────────────────────────
  if (message.action === "analyzeFrame") {
    if (!userPrompt) {
      sendError("No instructions provided. Please enter instructions first.");
      sendResponse({ success: false, error: "No instructions provided" });
      return true;
    }

    // Process the frame asynchronously
    processFrame(message, sender, sendResponse);
    return true; // Keep the message channel open for the async response
  }
});

async function processFrame(message, sender, sendResponse) {
  try {
    console.log("🔄 Sending JSON vision request…");

    // 1️⃣ Build the JSON payload
    const payload = {
      model: "gpt-4o",  // or "gpt-4o-mini"
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text:
                "Analyze this screenshot and instructions for this page and identify a step-by-step interaction path to accomplish the following task: " +
                "For each step: (these are only examples for the structure, not actual data) " +
                "1. Identify the exact UI element to interact with (button, input field, dropdown, etc.) " +
                "2. Provide the normalized coordinates [x, y, w, h] where: " +
                "   - x, y: position of the top-left corner (0-1 scale relative to viewport) " +
                "   - w, h: width and height of the element (0-1 scale relative to viewport) " +
                "3. Specify the action type: \"click\", \"type\", \"select\", etc. " +
                "4. Include a step number and brief description of what this step accomplishes " +
                "Return ONLY a JSON array with this structure: DO NOT INCLUDE A SINGLE WORD BESIDES THIS: " +
                "[{\"step\": 1, \"element\": \"Login Button\", \"action\": \"click\", \"x\": 0.8, \"y\": 0.2, \"w\": 0.1, \"h\": 0.05, \"description\": \"Click login button to open authentication dialog\"}, ...]" +
                "Ensure the steps are in logical sequence and will successfully complete the task."
            }
          ]
        },
        {
          role: "user",
          content: [
            { type: "text", text: "here are the instructions: " + userPrompt },
            { "type": "image_url",  "image_url": { "url": message.image } }
          ]
        }
      ]
    };

    console.log("➡️ Full messages payload:", JSON.stringify(payload.messages, null, 2));

    // 2️⃣ Send the request
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // 3️⃣ Check response
    const text = await res.text();
    console.log("🔍 Status:", res.status, res.statusText);
    console.log("🔍 Body:", text);
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${text}`);
    }

    // 4️⃣ Parse out boxes
const data = JSON.parse(text);
const assistantContent = data.choices[0].message.content;
// Depending on API shape, you might get an array or a string
let boxes;
if (Array.isArray(assistantContent)) {
  // If content is [{…}, { type:"text", text:"[...]"}]
  const imgPart = assistantContent.find(c => c.type === "text")?.text;
  boxes = JSON.parse(imgPart || "[]");
} else {
  // Strip markdown code blocks if present
  const cleanContent = assistantContent
    .replace(/```json\n/g, '')
    .replace(/```/g, '')
    .trim();
  boxes = JSON.parse(cleanContent);
}
    console.log("✅ Boxes:", boxes);

    // 5️⃣ Send boxes back to content script
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "drawBoxes",
        boxes
      });
    }
    sendResponse({ success: true, boxes });
  } catch (err) {
    console.error("❌ Failed to analyze image:", err);
    sendError("Failed to analyze image", err.message);
    sendResponse({ success: false, error: err.message });
  }
}


