document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("content");

  // Query all tabs
  chrome.tabs.query({}, (tabs) => {
    // Separate GenAI and Other tabs
    const genaiSites = ["chatgpt.com", "perplexity.ai", "claude.ai"];
    const genaiTabs = [];
    const otherTabs = [];

    tabs.forEach((tab) => {
      const url = tab.url || "";
      if (genaiSites.some((site) => url.includes(site))) {
        genaiTabs.push(tab);
      } else {
        otherTabs.push(tab);
      }
    });

    // Show GenAI table
    if (genaiTabs.length > 0) {
      const table = document.createElement("table");
      const header = table.insertRow();
      header.insertCell().textContent = "GenAI";
      header.insertCell().textContent = "URL";

      genaiTabs.forEach((tab) => {
        const row = table.insertRow();
        row.insertCell().textContent = tab.title;
        row.insertCell().textContent = tab.url;
      });

      content.appendChild(table);
    }

    // Show Other list
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
