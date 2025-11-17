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

// Extract animation handler

function showExtractAnimation(){
  extractBtn.disabled = true;
  loaderText.style.display = "block";
  loaderText.textContent = "Extracting...";

  setTimeout(() => {
    loaderText.textContent = "Done!";
    extractBtn.disabled = false;

    setTimeout(() => (loaderText.style.display = "none"), 900);
  }, 1200);
}

// ---- EXTRACT BUTTON ----
extractBtn.addEventListener("click", () => {
showExtractAnimation()
});


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

  const isAI = AI_SITES.some(site =>
    site.domains.some(domain => hostname.includes(domain))
  );

  extractBtn.disabled = !isAI;
});
