document.getElementById("save").addEventListener("click", () => {
  const ctx = document.getElementById("context").value;
  // Save the context
  chrome.storage.sync.set({ llmContext: ctx }, () => {
    const status = document.getElementById("status");
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);

    // Send message to the active tab to inject context
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      tabs.forEach(tab => {
        console.log(tab)
      });
      chrome.tabs.sendMessage(tabs[0].id, { action: "injectContext" });
    });
  });
});
