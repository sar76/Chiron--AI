document.getElementById('startButton').addEventListener('click', async () => {
    const userQuery = document.getElementById('userQuery').value.trim();
    const status = document.getElementById('statusMessage');
  
    if (!userQuery) {
      status.textContent = "Please enter a task.";
      return;
    }
  
    status.textContent = "Processing...";
  
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
      chrome.runtime.sendMessage({
        action: "processQuery",
        query: userQuery,
        tabId: tab.id
      });
  
      status.textContent = "Guide started!";
    } catch (error) {
      console.error(error);
      status.textContent = "Error starting guide.";
    }
  });
  