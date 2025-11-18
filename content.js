if (!window.contentScriptLoaded) {
  window.contentScriptLoaded = true;
  const AI_SITE_MAP = {
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "claude.ai": "claude",
    "gemini.google.com": "gemini",
    "ai.google.com": "gemini",
  };

  function getSiteType(hostname) {
    for (const host in AI_SITE_MAP) {
      if (hostname.includes(host)) {
        return AI_SITE_MAP[host];
      }
    }
    return null;
  }

  // ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "extractConversation") {
    const hostname = msg.hostname;
    const siteType = getSiteType(hostname);
    const rawConversation = extractConversation(siteType);

    // Make API request with proper error handling
    fetch("http://localhost:8000/summarize-conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw_conversation: rawConversation,
      }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (response.status === 200) {
          // Success - store in chrome storage
          console.log("💾 About to save:", data.summary);

          // Success - store in chrome storage
          chrome.storage.local.set({ latestContext: data.summary }).then(() => {
            console.log("✅ Summary saved to storage");

            // Verify it was saved
            chrome.storage.local.get(["latestContext"], (result) => {
              console.log("📦 Retrieved from storage:", result.latestContext);
            });

            sendResponse({
              success: true,
              message: data.summary,
            });
          });
        } else if (response.status === 500) {
          // Server error
          console.error("Server error:", data.summary);
          sendResponse({
            success: false,
            message: data.summary || "Internal server error",
          });
        } else {
          // Other HTTP errors
          console.error(`HTTP ${response.status}:`, data.summary);
          sendResponse({
            success: false,
            message:
              data.summary || `Server returned status ${response.status}`,
          });
        }
      })
      .catch((networkErr) => {
        // Network/connection errors
        console.error("Network error:", networkErr);
        sendResponse({
          success: false,
          message:
            "Failed to connect to server. Make sure your FastAPI server is running on http://localhost:8000",
        });
      });

    return true; // Keep channel open for async response
  } else if (msg.action == "injectContext") {
    try {
      chrome.storage.local.get(["latestContext"], (result) => {
        const conversationContext = result.latestContext;

        if (conversationContext === undefined) {
          console.log("Key doesn't exist");
          sendResponse({ success: false, message: "No context stored yet" });
          return;
        }

        injectContext(getSiteType(msg.hostname), conversationContext);
        sendResponse({ success: true, message: "Context injected" });
      });

      return true; // Keep message channel open for async response
    } catch (err) {
      console.log(err);
      sendResponse({ success: false, message: err.message });
      return true;
    }
  } else if (msg.action === "addContext") {
    try {
      const hostname = msg.hostname;
      const siteType = getSiteType(hostname);
      console.log(msg.url);
      console.log(msg.sourceTabId);

      if (!siteType) {
        sendResponse({ success: false, message: "Unsupported site" });
        return true;
      }

      const scrapeUrl = msg.url;
      if (!scrapeUrl) {
        sendResponse({
          success: false,
          message: "No URL provided from popup",
        });
        return true;
      }

      const summarize =
        typeof msg.summarize === "boolean" ? msg.summarize : true;
      const word_limit =
        typeof msg.word_limit === "number" ? msg.word_limit : 400;

      const bodyPayload = {
        url: scrapeUrl,
        summarize,
        word_limit,
      };

      fetch("http://localhost:8000/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      })
        .then(async (response) => {
          let data;
          try {
            data = await response.json();
          } catch (err) {
            sendResponse({
              success: false,
              message: "Invalid JSON returned from server",
            });
            return;
          }

          if (response.ok) {
            const serverText =
              data.summary ||
              data.extracted_text ||
              data.scraped ||
              data.output ||
              data.result ||
              "";

            if (!serverText) {
              sendResponse({
                success: false,
                message: "Scrape returned empty result",
              });
              return;
            }

            const editor = getEditor(siteType);
            if (!editor) {
              sendResponse({
                success: false,
                message: "Editor not found",
              });
              return;
            }

            const userInput = getInputText(siteType, editor);
            const finalInjectedText = `Here is some persistent user context you should always consider:\n\n${serverText}\n\nUser's query:\n\n${userInput}`;

            setInputText(siteType, editor, finalInjectedText);
            placeCursorAtEnd(editor);

            sendResponse({
              success: true,
              message: "Context added successfully",
              injected: finalInjectedText,
            });
            return;
          }

          const errMessage =
            data.message || data.detail || `HTTP ${response.status}`;
          sendResponse({ success: false, message: errMessage });
        })
        .catch((err) => {
          sendResponse({
            success: false,
            message:
              "Cannot connect to FastAPI server at http://localhost:8000/scrape",
          });
        });

      return true;
    } catch (err) {
      sendResponse({
        success: false,
        message: "Unexpected internal error",
      });
      return true;
    }
  }

  return true;

});

  // ==================== EXTRACT CONVERSATION ====================
function extractConversation() {
  try {
    const data = extractPageText(document.body);
    return data
  } catch (err) {
    console.error("Failed to extract conversation:", err);
  }
}

  // ==================== EXTRACT PAGE TEXT ====================
  function extractPageText(root) {
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
            "header",
            "footer",
            "aside",
          ];

          if (skipTags.includes(tag)) return;

          node.childNodes.forEach(walk);

          if (node.shadowRoot) {
            node.shadowRoot.childNodes.forEach(walk);
          }
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (text && text.length > 0) {
            output.push(text);
          }
        }
      } catch (err) {
        console.warn("Node walk failed:", err);
      }
    }

    walk(root);

    return output.join(" ").replace(/\s+/g, " ").trim().substring(0, 10000);
  }

  // ==================== GET EDITOR ====================
  function getEditor(site) {
    try {
      let selector = "";

      switch (site) {
        case "chatgpt":
          selector = "#prompt-textarea";
          break;
        case "claude":
          selector = 'div[contenteditable="true"][data-testid="chat-input"]';
          break;
        case "gemini":
          selector = "div.ql-editor.textarea[contenteditable='true']";
          break;
      }

      const editor = document.querySelector(selector);

      if (!editor) {
        console.warn(`Editor not found for ${site} with selector: ${selector}`);
      }

      return editor;
    } catch (err) {
      console.error("Get editor error:", err);
      return null;
    }
  }

  function injectContext(site, context) {
    try {
      const editor = getEditor(site);
      if (!editor) return;

      const userInput = getInputText(site, editor);
      console.log(userInput)
      const injectedMessage = `Here is some persistent user context you should always consider:\n\n${context}\n\nUser's query:\n\n${userInput}`;
      setInputText(site, editor, injectedMessage);
      placeCursorAtEnd(editor);
    } catch (err) {
      console.error("Failed to inject context:", err);
    }
  }


  // ==================== GET INPUT TEXT ====================
  function getInputText(site, editor) {
    try {
      if (!editor) return "";

      if (editor.isContentEditable) {
        return editor.innerText?.trim() || "";
      }

      return editor.value?.trim() || "";
    } catch (err) {
      console.warn("Get input text error:", err);
      return "";
    }
  }

  // ==================== SET INPUT TEXT ====================
  function setInputText(site, editor, text) {
    try {
      if (!editor) return;

      if (editor.isContentEditable) {
        editor.innerText = text;
        const inputEvent = new Event("input", { bubbles: true });
        editor.dispatchEvent(inputEvent);
        return;
      }

      editor.value = text;
      const inputEvent = new Event("input", { bubbles: true });
      const changeEvent = new Event("change", { bubbles: true });
      editor.dispatchEvent(inputEvent);
      editor.dispatchEvent(changeEvent);
    } catch (err) {
      console.error("Set input text error:", err);
    }
  }

  // ==================== PLACE CURSOR AT END ====================
  function placeCursorAtEnd(el) {
    try {
      if (!el) return;

      el.focus();

      if (el.isContentEditable) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      if (el.setSelectionRange) {
        const length = el.value.length;
        el.setSelectionRange(length, length);
      }
    } catch (err) {
      console.warn("Place cursor error:", err);
    }
  }
}
