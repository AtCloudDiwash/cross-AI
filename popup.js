document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("content");

  chrome.tabs.query({}, (tabs) => {
    const genaiSites = ["chatgpt.com", "perplexity.ai", "claude.ai"];
    const genaiTabs = [];
    const otherTabs = [];

    tabs.forEach((tab) => {
      if (!tab.url || !tab.url.startsWith("http")) return;

      const url = tab.url;

      if (genaiSites.some((site) => url.includes(site))) {
        genaiTabs.push(tab);
      } else {
        otherTabs.push(tab);
      }
    });

    // ========== GENAI LIST ==========
    if (genaiTabs.length > 0) {
      const table = document.createElement("table");
      const header = table.insertRow();
      header.insertCell().textContent = "GenAI";
      header.insertCell().textContent = "URL";
      header.insertCell().textContent = "Actions";

      genaiTabs.forEach((tab) => {
        const row = table.insertRow();

        row.insertCell().textContent = tab.title;
        row.insertCell().textContent = tab.url;

        const actionCell = row.insertCell();

        const extractBtn = document.createElement("button");
        extractBtn.textContent = "Extract";
        extractBtn.className = "extract-btn";
        extractBtn.addEventListener("click", () => {
          sendSiteAction(tab, "extract");
        });

        const injectBtn = document.createElement("button");
        injectBtn.textContent = "Inject";
        injectBtn.className = "inject-btn";

        injectBtn.addEventListener("click", () => {
          chrome.storage.sync.get(["llmContext"], (data) => {
            sendSiteAction(tab, "inject", data.llmContext || "");
          });
        });
        actionCell.appendChild(extractBtn);
        actionCell.appendChild(injectBtn);
      });

      content.appendChild(table);
    }

    // ========== OTHER TABS ==========
    if (otherTabs.length > 0) {
      const h3 = document.createElement("h3");
      h3.textContent = "Other";
      content.appendChild(h3);

      const ul = document.createElement("ul");
      otherTabs.forEach((tab) => {
        const li = document.createElement("li");
        li.textContent = `${tab.title} — ${tab.url}`;
        ul.appendChild(li);
      });
      content.appendChild(ul);
    }
  });
});

// =========================================================
// SEND MESSAGE TO CONTENT SCRIPT BY SITE TYPE
// =========================================================

function sendSiteAction(tab, action) {
  let site = "";

  if (tab.url.includes("chatgpt.com")) site = "chatgpt";
  else if (tab.url.includes("claude.ai")) site = "claude";
  else if (tab.url.includes("perplexity.ai")) site = "perplexity";

  const message = { action, site };

  chrome.tabs.sendMessage(tab.id, message, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        "Content script not available:",
        chrome.runtime.lastError.message
      );
    }
  });
}
