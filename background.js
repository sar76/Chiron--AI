// background.js

// Replace with your actual key, or load from chrome.storage
const OPENAI_API_KEY = "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";

// Listen for the popup’s “processQuery” message
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "processQuery") {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      (tabs) => {
        if (tabs[0]?.id) {
          runGuideFlow(message.query, tabs[0].id);
        } else {
          console.error("No active tab to guide on");
        }
      }
    );
    return true;
  }
});


async function runGuideFlow(query, tabId) {
  try {
    // 1) Grab the full page HTML from the content script
    const pageHtml = await getPageHtml(tabId);

    // 2) Ask GPT to produce a JSON steps array for this HTML + query
    const steps = await getStepsFromGPT(query, pageHtml);

    // 3) Send those steps back to the content script
    chrome.tabs.sendMessage(tabId, {
      action: "startGuide",
      steps
    });
  } catch (err) {
    console.error("Guide flow failed:", err);
    chrome.tabs.sendMessage(tabId, {
      action: "guideError",
      message: err.message || String(err)
    });
  }
}

// Helper: ask the content script in tabId for its document HTML
function getPageHtml(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { action: "getPageHtml" },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!response || !response.html) {
          return reject(new Error("No HTML received from content script"));
        }
        resolve(response.html);
      }
    );
  });
}

// Helper: call OpenAI ChatGPT to convert HTML+query → JSON steps
async function getStepsFromGPT(query, pageHtml) {
  const systemPrompt = `
You are a UI automation generator.
You will be given the full HTML of a web page and a user task.
Output ONLY a JSON array of steps.
Each step must be an object with:
  • "action": "highlight"
  • "selector": a valid CSS selector that matches exactly one element on the page
Do NOT emit any "click" actions or any prose/explanation—only the JSON array of highlight steps.
`;

  const userPrompt = `
PAGE HTML:
\`\`\`html
${pageHtml.slice(0, 200000)}  
\`\`\`

USER TASK:
"${query}"
`;

  const body = {
    model: "gpt-4o-mini",     // or whichever ChatGPT model you’re using
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 500
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${errText}`);
  }
  const json = await resp.json();
  const content = json.choices[0].message.content.trim();

  // Parse and return the JSON array
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("Failed to parse GPT response as JSON:\n" + content);
  }
}
