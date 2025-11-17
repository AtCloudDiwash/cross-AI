// =============================================================
//  MESSAGE LISTENER
// =============================================================
chrome.runtime.onMessage.addListener((msg) => {
  try {
    const conversation = localStorage.getItem("conversation") || "";

    switch (msg.action) {
      case "extract":
        extractConversation(msg.site);
        break;
      case "inject":
        injectContext(msg.site, conversation);
        break;
    }
  } catch (err) {
    console.error("Error in message listener:", err);
  }
});

// =============================================================
//  UNIVERSAL EXTRACTOR
// =============================================================
function extractConversation(site) {
  try {
    const data = extractMinimalConversation(document.body);
    localStorage.setItem("conversation", data);
  } catch (err) {
    console.error("Failed to extract conversation:", err);
  }
}

// =============================================================
//  MINIMAL DOM TEXT EXTRACTOR
// =============================================================
function extractMinimalConversation(root) {
  const output = [];

  function walk(node) {
    try {
      if (!node) return;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const skipTags = [
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
        ];
        if (skipTags.includes(tag)) return;

        node.childNodes.forEach(walk);

        if (node.shadowRoot) node.shadowRoot.childNodes.forEach(walk);
      }

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (!text) return;

        if (/^(You said:|GenAI said:)/i.test(text)) {
          output.push(text);
        } else {
          output.push(text.replace(/\s+/g, " "));
        }
      }
    } catch (err) {
      console.warn("Node walk failed:", err);
    }
  }

  walk(root);
  return output.join(" ").replace(/\s+/g, " ").trim();
}

// =============================================================
//  SITE-SPECIFIC EDITORS
// =============================================================
function getEditor(site) {
  try {
    if (site === "chatgpt") return document.querySelector("#prompt-textarea");
    if (site === "claude")
      return document.querySelector(
        'div[contenteditable="true"][data-testid="chat-input"]'
      );
 if (site === "gemini") {
   return document.querySelector(
     "div.ql-editor.textarea.new-input-ui[contenteditable='true'] p"
   );
 }
  } catch (err) {
    console.warn("Failed to get editor for site:", site, err);
  }
  return null;
}

// =============================================================
//  UNIVERSAL INJECTOR
// =============================================================
function injectContext(site, contextText) {
  try {
    const editor = getEditor(site);
    if (!editor) return;

    const userInput = getInputText(site, editor);
    const injectedMessage = `Here is some persistent user context you should always consider: ${contextText}\n\n${userInput}`;
    setInputText(site, editor, injectedMessage);
    placeCursorAtEnd(editor);
  } catch (err) {
    console.error("Failed to inject context:", err);
  }
}

// =============================================================
//  GET USER INPUT
// =============================================================
function getInputText(site, editor) {
  try {
    return editor?.innerText?.trim() || "";
  } catch (err) {
    console.warn("Failed to get user input:", err);
    return "";
  }
}

// =============================================================
//  SET TEXT BACK INTO EDITOR
// =============================================================
function setInputText(site, editor, text) {
  try {
      editor.innerText = text;
  } catch (err) {
    console.error("Failed to set text in editor:", err);
  }
}

// =============================================================
//  ESCAPE HTML
// =============================================================
function escapeHTML(str) {
  try {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  } catch (err) {
    console.warn("Failed to escape HTML:", err);
    return str;
  }
}

// =============================================================
//  PLACE CURSOR AT END
// =============================================================
function placeCursorAtEnd(el) {
  try {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    el.focus();
  } catch (err) {
    console.warn("Failed to place cursor at end:", err);
  }
}
