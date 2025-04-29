// content.js

let videoEl, canvasEl, ctx, captureInterval;
let errorOverlay = null;

// Log when content script loads
console.log("🔄 Content script loaded");

// Listen for commands from background (or popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`📨 Content script received message: ${message.action}`);
  
  if (message.action === "startCapture") {
    startCapture().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error("❌ Error starting capture:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for the async response
  }
  if (message.action === "stopCapture") {
    stopCapture();
    sendResponse({ success: true });
    return true;
  }
  if (message.action === "drawBoxes") {
    drawBoxes(message.boxes);
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

// 1) Start grabbing the screen
async function startCapture() {
  stopCapture(); // in case it's already running

  try {
    console.log("🔄 Requesting screen capture permission");
    
    // Request screen capture from the background script
    const streamId = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getStreamId" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.streamId) {
          resolve(response.streamId);
        } else {
          reject(new Error("Failed to get stream ID"));
        }
      });
    });
    
    console.log("✅ Got stream ID:", streamId);
    
    // Use the stream ID to get the actual stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    console.log("✅ Screen capture permission granted");
    
    videoEl = document.createElement("video");
    videoEl.srcObject = stream;
    videoEl.play();

    // once we know dimensions, make the canvas
    videoEl.onloadedmetadata = () => {
      console.log("✅ Video metadata loaded, dimensions:", videoEl.videoWidth, "x", videoEl.videoHeight);
      canvasEl = document.createElement("canvas");
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      ctx = canvasEl.getContext("2d");

      // every 2 seconds, grab a frame
      console.log("🔄 Starting frame capture interval");
      captureInterval = setInterval(captureFrame, 10000);
    };
  } catch (error) {
    console.error("❌ Error starting capture:", error);
    throw error;
  }
}

// 2) Stop grabbing
function stopCapture() {
  console.log("🔄 Stopping capture");
  clearInterval(captureInterval);
  if (videoEl?.srcObject) {
    videoEl.srcObject.getTracks().forEach((t) => t.stop());
  }
}

// 3) Grab one frame, send to background
function captureFrame() {
  if (!ctx) {
    console.error("❌ Canvas context not available");
    return;
  }
  
  try {
    console.log("🔄 Capturing frame...");
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    const dataUrl = canvasEl.toDataURL("image/png");
    console.log(`✅ Frame captured, size: ${dataUrl.length} bytes`);
    
    // Send to background script
    chrome.runtime.sendMessage({ 
      action: "analyzeFrame", 
      image: dataUrl 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Error sending message:", chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log("✅ Message sent to background script, boxes received:", response.boxes);
      } else {
        console.error("❌ Error from background script:", response?.error || "Unknown error");
      }
    });
  } catch (error) {
    console.error("❌ Error capturing frame:", error);
  }
}

// 4) Overlay bounding boxes
function drawBoxes(boxes) {
  console.log("🔄 Drawing boxes:", boxes);
  
  // remove old overlays
  document.querySelectorAll(".oas-box-overlay").forEach((el) => el.remove());

  // Get scroll position
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  boxes.forEach((b) => {
    const div = document.createElement("div");
    div.className = "oas-box-overlay";
    // normalize coordinates accounting for scroll
    div.style.position = "absolute"; // Changed from fixed to absolute
    div.style.left = `${(b.x * window.innerWidth) + scrollX}px`;
    div.style.top = `${(b.y * window.innerHeight) + scrollY}px`;
    div.style.width = `${b.w * window.innerWidth}px`;
    div.style.height = `${b.h * window.innerHeight}px`;
    div.style.border = "2px solid red";
    div.style.zIndex = 999999;
    document.body.appendChild(div);
  });
}
