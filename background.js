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

  // ─── Analyze DOM for guidance ──────────────────────────────────
  if (message.action === "analyzeDom") {
    if (!userPrompt) {
      sendError("No instructions provided. Please enter instructions first.");
      sendResponse({ success: false, error: "No instructions provided" });
      return true;
    }

    // Process the DOM asynchronously
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
});

async function analyzeDomForGuidance(domSnapshot, sender, sendResponse) {
  try {
    console.log("🔄 Analyzing DOM for guidance...");

    // 1️⃣ Build the JSON payload for the AI
    const payload = {
      model: "gpt-4o",  // or "gpt-4o-mini" for lower cost
      messages: [
        {
          role: "system",
          content: 
            "You are a DOM analysis expert that can help users navigate websites. " +
            "Given a DOM snapshot and a user's goal, identify the most logical sequence of steps to achieve that goal. " +
            "For each step, find the exact DOM element to interact with and provide its details. " +
            "Focus only on UI elements that can be interacted with (buttons, links, input fields, dropdowns, etc.) " +
            "Return ONLY a JSON array with this structure: " +
            "[{\"step\": 1, \"element\": \"Login Button\", \"action\": \"click\", " +
            "\"selector\": \"#login-btn\", \"xpath\": \"//button[@id='login-btn']\", " +
            "\"text\": \"Log In\", \"description\": \"Click the login button\"}]"
        },
        {
          role: "user",
          content: 
            "Here is the user's goal: " + userPrompt + "\n\n" +
            "Here is a snapshot of the current DOM: " + domSnapshot
        }
      ]
    };

    // 2️⃣ Send the request to OpenAI
    console.log("🔄 Sending DOM analysis request to OpenAI...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
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
      .replace(/```json\n/g, '')
      .replace(/```/g, '')
      .trim();
    
    const steps = JSON.parse(cleanContent);
    console.log("✅ Guidance steps:", steps);

    // 5️⃣ Send steps back to content script
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "showGuidance",
        steps
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
      model: "gpt-4o-mini",  // Use smaller model for this simpler task
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
             "Example: [{\"step\": 1, \"element\": \"Login Button\", \"action\": \"click\", " +
              "\"selector\": \"#login-btn\", \"xpath\": \"//button[@id='login-btn']\", " +
             "\"text\": \"Log In\", \"description\": \"Click the login button\"}]"
            },
        {
          role: "user",
          content: 
            "My goal is: " + userPrompt + "\n\n" +
            "I just completed step " + currentStep + ". What should I do next? \n\n" +
            "Here is the current DOM: " + domSnapshot
        }
      ]
    };

    // 2️⃣ Send the request to OpenAI
    console.log("🔄 Sending next step request to OpenAI...");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
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
      .replace(/```json\n/g, '')
      .replace(/```/g, '')
      .trim();
    
    const nextStep = JSON.parse(cleanContent);
    console.log("✅ Next step:", nextStep);

    // 5️⃣ Send next step back to content script
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "showNextStep",
        step: nextStep
      });
    }
    sendResponse({ success: true, step: nextStep });
  } catch (err) {
    console.error("❌ Failed to get next step:", err);
    sendError("Failed to get next step", err.message);
    sendResponse({ success: false, error: err.message });
  }
}