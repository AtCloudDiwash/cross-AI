// Listen for messages from the popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "injectContext") {
    injectContext();
  }
});

//extract only necessary

function extractMinimalConversation(root) {
  let output = [];

  function walk(node) {
    if (!node) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      // Skip non-content / UI tags
      if (
        [
          "script",
          "style",
          "noscript",
          "svg",
          "path",
          "button",
          "input",
          "form",
          "audio",
          "nav",
        ].includes(tag)
      )
        return;

      // Recurse into children
      node.childNodes.forEach(walk);

      // Shadow DOM support
      if (node.shadowRoot) {
        node.shadowRoot.childNodes.forEach(walk);
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (!text) return;

      // Keep only relevant content
      if (/^(You said:|ChatGPT said:)/i.test(text)) {
        output.push(text);
      } else {
        output.push(text.replace(/\s+/g, " "));
      }
    }
  }

  walk(root);

  // Join into a single compressed string
  return output.join(" ").replace(/\s+/g, " ").trim();
}

// Inject saved context into the current ChatGPT textarea
function injectContext() {
  const editor = document.querySelector("#prompt-textarea");
  localStorage.setItem(
    "conversation",
    extractMinimalConversation(document.body)
  );
  if (!editor) return;

  chrome.storage.sync.get(["llmContext"], ({ llmContext }) => {
    if (!llmContext) return;

    // Prepend context to whatever user has typed
    const userInput = editor.innerText.trim();
    const injectedMessage =
      `Here is some persistent user context you should always consider: ${llmContext}\n\n` +
      userInput;

    editor.innerText = injectedMessage;

    // Optional: place cursor at the end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    editor.focus();
  });
}
