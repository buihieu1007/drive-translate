// content.js - Pure Standalone Direct Inline Webpage Translator

(function () {
  // Prevent duplicate injections
  if (window.hasDriveTranslateInjected) {
    console.log("[DriveTranslate DEBUG] Already injected, skipping duplicate setup.");
    return;
  }
  window.hasDriveTranslateInjected = true;

  console.log("[DriveTranslate DEBUG] 🚀 ACTIVE! Standalone content script successfully injected on page:", window.location.href);

  // Local settings synced with storage
  let currentSource = 'auto'; // Default source language
  let currentTarget = 'en'; // Default target language
  let autoTranslateEnabled = true; // Default to ON!
  let pageObserver = null;
  let scanTimeout = null;

  // SPA navigation url tracking
  let lastUrl = location.href;
  let urlCheckInterval = null;

  // Track translated elements in memory to allow restorations
  const originalTextsMap = new Map(); // node -> original string

  // Gracefully handle Extension Context Invalidated (when extension is reloaded/updated)
  function isContextValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function cleanUpOrphanedScript() {
    if (pageObserver) {
      try {
        pageObserver.disconnect();
      } catch (err) {}
      pageObserver = null;
    }
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }
    stopUrlWatcher();
    console.log("[DriveTranslate DEBUG] Extension context invalidated (extension was reloaded/updated). Observer disconnected successfully.");
  }

  /**
   * Helper to verify if a text node should be translated based on the chosen source language
   * @param {string} text
   * @param {string} sourceLang
   */
  function shouldTranslateText(text, sourceLang) {
    if (!text) return false;
    
    // Normalization and basic filters
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 500) return false;
    
    // If target language is the same as source, skip
    if (sourceLang !== 'auto' && sourceLang === currentTarget) return false;
    
    // Check match based on language group regexes to avoid translating English text nodes
    switch (sourceLang) {
      case 'zh-CN':
      case 'zh-TW':
      case 'zh':
        // Chinese characters (Simplified, Traditional, extension blocks)
        return /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/.test(trimmed);
      case 'ja':
        // Japanese characters (Hiragana, Katakana, Kanji)
        return /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9faf]/.test(trimmed);
      case 'ko':
        // Korean characters (Hangul)
        return /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/.test(trimmed);
      case 'ru':
      case 'be':
      case 'uk':
      case 'bg':
      case 'sr':
      case 'mk':
        // Cyrillic characters
        return /[\u0400-\u04ff]/.test(trimmed);
      case 'ar':
      case 'fa':
      case 'ur':
      case 'ps':
        // Arabic script
        return /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/.test(trimmed);
      case 'hi':
      case 'ne':
      case 'mr':
        // Devanagari script (Hindi, Marathi, etc.)
        return /[\u0900-\u097f]/.test(trimmed);
      case 'th':
        // Thai characters
        return /[\u0e00-\u0e7f]/.test(trimmed);
      case 'el':
        // Greek characters
        return /[\u0370-\u03ff\u1f00-\u1fff]/.test(trimmed);
      case 'he':
      case 'iw':
        // Hebrew characters
        return /[\u0590-\u05ff]/.test(trimmed);
      case 'auto':
        // 'auto' matches any CJK, Cyrillic, Arabic, Devanagari, Thai, Greek, Hebrew, or Latin Extended accented character
        return /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7a3\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u0370-\u03ff\u0590-\u05ff\u00C0-\u024F]/.test(trimmed);
      default:
        // For other languages using Latin character sets, they explicitly selected it.
        // We match if it contains any standard or extended Latin letters, bypassing purely numbers/symbols.
        return /[a-zA-Z\u00C0-\u024F]/.test(trimmed);
    }
  }

  // Load language settings on startup and sync
  function syncSettings() {
    chrome.storage.local.get(['lastSourceLang', 'lastTargetLang', 'autoTranslateEnabled'], (res) => {
      if (res.lastSourceLang) currentSource = res.lastSourceLang;
      if (res.lastTargetLang) currentTarget = res.lastTargetLang;
      // Default to true if not explicitly set to false
      autoTranslateEnabled = res.autoTranslateEnabled !== false;
      
      console.log("[DriveTranslate DEBUG] Synced settings:", { 
        autoTranslateEnabled,
        currentSource,
        currentTarget 
      });
      
      if (autoTranslateEnabled) {
        startAutoTranslation();
      } else {
        stopAutoTranslation();
      }
    });
  }

  // Monitor storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      console.log("[DriveTranslate DEBUG] Settings updated:", changes);
      
      let needsReTranslate = false;

      if (changes.lastSourceLang) {
        currentSource = changes.lastSourceLang.newValue;
        needsReTranslate = true;
      }
      
      if (changes.lastTargetLang) {
        currentTarget = changes.lastTargetLang.newValue;
        needsReTranslate = true;
      }

      if (needsReTranslate && autoTranslateEnabled) {
        console.log("[DriveTranslate DEBUG] Language switched (Source:", currentSource, ", Target:", currentTarget, ") - Re-translating page...");
        restoreOriginalText();
        debouncedScanAndTranslate();
      }
      
      if (changes.autoTranslateEnabled) {
        autoTranslateEnabled = changes.autoTranslateEnabled.newValue !== false;
        if (autoTranslateEnabled) {
          startAutoTranslation();
        } else {
          stopAutoTranslation();
        }
      }
    }
  });

  // Monitor runtime messages from extension popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'forceTranslate') {
      console.log("[DriveTranslate DEBUG] ⚡ Manual 'Translate Now' triggered. Force-scanning page...");
      scanAndTranslateFolderNames(true);
      if (sendResponse) sendResponse({ success: true });
    }
  });

  // 1. Auto Folder & File Name Translation Feature
  function startAutoTranslation() {
    console.log("[DriveTranslate DEBUG] Auto-Translation is now ON. Scanning page...");
    
    // Run initial scan
    debouncedScanAndTranslate();

    // Start URL watcher for SPA directory changes
    startUrlWatcher();

    // Set up MutationObserver to watch for dynamic DOM additions and text changes recursively
    if (!pageObserver) {
      console.log("[DriveTranslate DEBUG] Listening for dynamic screen updates (MutationObserver)...");
      pageObserver = new MutationObserver((mutations) => {
        if (!isContextValid()) {
          cleanUpOrphanedScript();
          return;
        }
        debouncedScanAndTranslate();
      });
      pageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  function stopAutoTranslation() {
    console.log("[DriveTranslate DEBUG] Auto-Translation is now OFF. Reverting page text to original...");
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }
    stopUrlWatcher();
    restoreOriginalText();
  }

  // URL Watcher logic for Single Page App directory changes
  function startUrlWatcher() {
    if (urlCheckInterval) clearInterval(urlCheckInterval);

    urlCheckInterval = setInterval(() => {
      if (!isContextValid()) {
        clearInterval(urlCheckInterval);
        return;
      }
      if (location.href !== lastUrl) {
        handleUrlChanged();
      }
    }, 500);

    window.addEventListener('popstate', handleUrlChanged);
    window.addEventListener('hashchange', handleUrlChanged);
  }

  function handleUrlChanged() {
    if (!isContextValid()) return;
    if (location.href !== lastUrl) {
      console.log("[DriveTranslate DEBUG] 📂 Directory changed! URL:", location.href);
      lastUrl = location.href;
      
      // Clear memory of previous folder text nodes to free memory
      originalTextsMap.clear();
      
      // Immediate translation scan in the new directory
      debouncedScanAndTranslate();
    }
  }

  function stopUrlWatcher() {
    if (urlCheckInterval) {
      clearInterval(urlCheckInterval);
      urlCheckInterval = null;
    }
    window.removeEventListener('popstate', handleUrlChanged);
    window.removeEventListener('hashchange', handleUrlChanged);
  }

  function debouncedScanAndTranslate() {
    if (!isContextValid()) {
      cleanUpOrphanedScript();
      return;
    }
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      scanAndTranslateFolderNames();
    }, 200);
  }

  function scanAndTranslateFolderNames(force = false) {
    if (!isContextValid()) {
      cleanUpOrphanedScript();
      return;
    }
    if (!autoTranslateEnabled && !force) return;

    // Use native TreeWalker for DOM-independent text node extraction
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          const text = node.textContent.trim();
          
          // Skip empty text or excessively long chunks (up to 500 characters)
          if (!text || text.length > 500) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check if the text matches the source language filter requirements
          if (!shouldTranslateText(text, currentSource)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Ignore script, style, code, textarea, and input tags
          const tagName = parent.tagName.toLowerCase();
          if (tagName === 'script' || tagName === 'style' || tagName === 'textarea' || tagName === 'input' || tagName === 'code' || tagName === 'noscript' || tagName === 'head') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if parent is marked as translated/pending
          if (parent.hasAttribute('data-dt-translated')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToTranslate = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      nodesToTranslate.push(currentNode);
    }

    if (nodesToTranslate.length === 0) return;

    console.log(`[DriveTranslate DEBUG] Scan found ${nodesToTranslate.length} nodes to translate.`);

    // Batch process in size of 25 to safeguard APIs and browser performance
    const BATCH_SIZE = 25;
    for (let i = 0; i < nodesToTranslate.length; i += BATCH_SIZE) {
      const batch = nodesToTranslate.slice(i, i + BATCH_SIZE);
      translateBatch(batch, force);
    }
  }

  function translateBatch(batch, force = false) {
    const nodesToProcess = [];
    const trimmedTexts = [];

    batch.forEach(node => {
      const parent = node.parentElement;
      if (!parent) return;

      // Mark parent as pending
      parent.setAttribute('data-dt-translated', 'pending');

      const originalText = node.textContent;
      const trimmedText = originalText.trim();

      nodesToProcess.push({ node, parent, originalText, trimmedText });
      trimmedTexts.push(trimmedText);
    });

    if (nodesToProcess.length === 0) return;

    // Combine all trimmed texts using newline character \n
    const combinedText = trimmedTexts.join('\n');
    
    console.log(`[DriveTranslate DEBUG] Sending batch of ${nodesToProcess.length} items to translate...`);

    chrome.runtime.sendMessage({
      action: 'translate',
      text: combinedText,
      source: currentSource,
      target: currentTarget
    }, (response) => {
      if (!autoTranslateEnabled && !force) {
        nodesToProcess.forEach(item => {
          item.parent.removeAttribute('data-dt-translated');
        });
        return;
      }

      if (response && response.success && response.data && response.data.translations) {
        const transMap = new Map();
        response.data.translations.forEach(t => {
          transMap.set(t.original.toLowerCase(), t.translated);
        });

        nodesToProcess.forEach(item => {
          const translated = transMap.get(item.trimmedText.toLowerCase());
          if (translated) {
            item.parent.setAttribute('data-dt-translated', 'true');
            
            // Store original text state
            originalTextsMap.set(item.node, item.originalText);
            item.parent.setAttribute('data-dt-original-text-stored', 'true');

            // Replace inline
            item.node.textContent = item.originalText.replace(item.trimmedText, translated);
            console.log(`[DriveTranslate DEBUG] SUCCESS: "${item.trimmedText}" -> "${translated}"`);
          } else {
            // Fallback if not found in batch translation response (e.g. alignment issues)
            translateIndividualFallback(item, force);
          }
        });
      } else {
        const errMsg = response ? response.error : 'Service unreachable';
        console.warn(`[DriveTranslate DEBUG] Batch request failed, falling back:`, errMsg);
        
        // Fallback to individual translation
        nodesToProcess.forEach(item => {
          translateIndividualFallback(item, force);
        });
      }
    });
  }

  function translateIndividualFallback(item, force = false) {
    chrome.runtime.sendMessage({
      action: 'translate',
      text: item.trimmedText,
      source: currentSource,
      target: currentTarget
    }, (response) => {
      if (!autoTranslateEnabled && !force) {
        item.parent.removeAttribute('data-dt-translated');
        return;
      }

      if (response && response.success && response.data && response.data.translations && response.data.translations[0]) {
        const translated = response.data.translations[0].translated;
        item.parent.setAttribute('data-dt-translated', 'true');

        originalTextsMap.set(item.node, item.originalText);
        item.parent.setAttribute('data-dt-original-text-stored', 'true');

        item.node.textContent = item.originalText.replace(item.trimmedText, translated);
        console.log(`[DriveTranslate DEBUG] FALLBACK SUCCESS: "${item.trimmedText}" -> "${translated}"`);
      } else {
        console.warn(`[DriveTranslate DEBUG] FALLBACK FAILED for "${item.trimmedText}"`);
        item.parent.removeAttribute('data-dt-translated');
      }
    });
  }

  function restoreOriginalText() {
    console.log(`[DriveTranslate DEBUG] Restoring ${originalTextsMap.size} text nodes back to original language...`);
    
    originalTextsMap.forEach((originalText, node) => {
      try {
        if (node && node.parentElement) {
          node.textContent = originalText;
          node.parentElement.removeAttribute('data-dt-translated');
          node.parentElement.removeAttribute('data-dt-original-text-stored');
        }
      } catch (err) {
        // Parent or node might have been removed dynamically from DOM
      }
    });

    originalTextsMap.clear();

    // Clean up any stray attributes
    const marked = document.querySelectorAll('[data-dt-translated], [data-dt-original-text-stored]');
    marked.forEach(el => {
      el.removeAttribute('data-dt-translated');
      el.removeAttribute('data-dt-original-text-stored');
    });
  }

  // Auto-initialize settings
  syncSettings();

})();
