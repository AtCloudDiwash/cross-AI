const extractBtn = document.getElementById("extractBtn");
const loaderText = document.getElementById("loaderText");
const aiList = document.getElementById("aiList");
const otherList = document.getElementById("otherList");
const closeBtn = document.getElementById("closeBtn");

// Updated AI detection rules:
const AI_SITES = [
  {
    domains: ["chatgpt.com", "chat.openai.com"],
    logo: "icons/chatgpt.svg",
  },
  {
    domains: ["claude.ai"],
    logo: "icons/claude.svg",
  },
  {
    domains: ["gemini.google.com", "ai.google.com"],
    logo: "icons/gemini.svg",
  },
];

closeBtn.addEventListener("click", () => {
  window.close();
});

// ---- LOAD TABS ----
chrome.tabs.query({}, (tabs) => {
  tabs.forEach((tab) => {
    if (
      !tab.url ||
      tab.url.startsWith("chrome:") ||
      tab.url.startsWith("extension:")
    )
      return;

    let hostname;
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      hostname = tab.url;
    }

    let matchedAISite = null;

    for (const site of AI_SITES) {
      if (site.domains.some((domain) => hostname.includes(domain))) {
        matchedAISite = site;
        break;
      }
    }

    const isAI = Boolean(matchedAISite);

    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.className = "item-left";

    const logo = document.createElement("img");
    logo.className = "item-logo";
    if (isAI) {
      logo.src = matchedAISite.logo;
    } else if (tab.favIconUrl) {
      logo.src = tab.favIconUrl;
    } else {
      logo.src = "icons/website.svg";
    }

    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = tab.title || tab.url || "Untitled";

    left.appendChild(logo);
    left.appendChild(title);

    const btn = document.createElement("button");
    btn.className = "item-btn";
    btn.textContent = isAI ? "Inject" : "Add";
    btn.dataset.tabId = tab.id;

    if (isAI) {
      // Inject buttons: enable only if active
      btn.disabled = true; // default disabled
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id === tab.id) {
          btn.disabled = false; // enable only if this tab is active
        }
      });
    }

    item.appendChild(left);
    item.appendChild(btn);

    if (isAI) aiList.appendChild(item);
    else otherList.appendChild(item);
  });
});

// Disabling

// By default, disable extract button
extractBtn.disabled = true;

// Check active tab and enable only for AI sites
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0];
  if (!activeTab || !activeTab.url) return;

  let hostname;
  try {
    hostname = new URL(activeTab.url).hostname;
  } catch {
    hostname = activeTab.url;
  }

  const isAI = AI_SITES.some((site) =>
    site.domains.some((domain) => hostname.includes(domain))
  );

  extractBtn.disabled = !isAI;
});

// Extract state handler
function showLoadingState(stateName) {
  extractBtn.disabled = true;
  loaderText.style.display = "block";
  loaderText.textContent = stateName;
  loaderText.className = "loader-text loading";
}

function hideLoadingState(){
    extractBtn.disabled = false;
    loaderText.style.display = "block";
    loaderText.textContent = "";
}

function showSuccessState() {
  loaderText.textContent = "✓ Done!";
  loaderText.className = "loader-text success";

  setTimeout(() => {
    loaderText.style.display = "none";
    extractBtn.disabled = false;
  }, 2000);
}

function showErrorState(errorMessage) {
  loaderText.textContent = "✗ " + errorMessage;
  loaderText.className = "loader-text error";

  setTimeout(() => {
    loaderText.style.display = "none";
    extractBtn.disabled = false;
  }, 4000);
}

// ---- EXTRACT BUTTON ----
extractBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) {
      showErrorState("No active tab found!");
      return;
    }

    const hostname = new URL(activeTab.url).hostname;

    // Show loading state
    showLoadingState("Extracting....");

    // Inject content script if not already present
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"],
      });
      console.log("Content script injected");
    } catch (err) {
      console.log("Script already loaded or error:", err);
    }

    // Wait for script to be ready
    await new Promise((resolve) => setTimeout(resolve, 300));

    await chrome.tabs.sendMessage(
      activeTab.id,
      { action: "extractConversation", hostname },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          showErrorState("Content script not loaded!");
          return;
        }

        if (response && response.success) {
          showSuccessState();
        } else {
          showErrorState(response?.message || "Extraction failed");
        }
      }
    );
  });
});


// ---- INJECT AND ADD BUTTONS ----
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("item-btn")) return;

  const tabId = Number(e.target.dataset.tabId);
  const buttonText = e.target.textContent;

  // Handle INJECT button
  if (buttonText === "Inject") {
    console.log("Inject clicked for tab:", tabId);

    try {
      // 1. Ensure content script is injected
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch (err) {
      console.warn("Content script injection warning:", err.message);
    }

    // 2. Give script time to initialize
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 3. Get tab info to extract hostname
    chrome.tabs.get(tabId, (tab) => {
      const hostname = new URL(tab.url).hostname;

      // 4. Send message with hostname
      chrome.tabs.sendMessage(
        tabId,
        { action: "injectContext", hostname: hostname },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "InjectContext failed:",
              chrome.runtime.lastError.message
            );
            return;
          }

          if (!response || !response.success) {
            console.error(
              "InjectContext error:",
              response?.message || "No proper response"
            );
            return;
          }

          console.log("InjectContext success");
        }
      );
    });
  }

  // Handle ADD button
  if (buttonText === "Add") {
    console.log("Add clicked for tab:", tabId);

    showLoadingState("Adding...")
    try {
      // Get BOTH the clicked tab AND the active tab
      const [activeTab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      const activeTabId = activeTab.id;

      // Get the clicked tab's info
      chrome.tabs.get(tabId, async (clickedTab) => {
        const clickedUrl = clickedTab.url;

        console.log("Clicked tab URL:", clickedUrl);
        console.log("Active tab ID:", activeTabId);
        console.log("Active tab URL:", activeTab.url);

        // Inject content script into ACTIVE tab
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            files: ["content.js"],
          });
        } catch (err) {
          console.warn("Content script injection warning:", err.message);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Send to the ACTIVE tab (where you currently are)
        chrome.tabs.sendMessage(
          activeTabId, // Send to active tab (AI chatbot)
          {
            action: "addContext",
            url: clickedUrl, // URL of the tab you clicked "Add" on
            sourceTabId: tabId, // Optional: ID of the source tab
            hostname: new URL(activeTab.url).hostname,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Add context failed:",
                chrome.runtime.lastError.message
              );
              return;
            }

            if (response && response.success) {
              console.log("Add context success!");
              hideLoadingState()
              hide
            } else {
              console.error("Add context error:", response?.message);
            }
          }
        );
      });
    } catch (err) {
      console.error("Error handling Add button:", err);
    }
  }
});