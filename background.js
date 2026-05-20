// background.js - DriveTranslate Proxy Service Worker

// Listen for message requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request.text, request.source, request.target)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error("Translation error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async sendResponse
  }
});

/**
 * Performs translation using Google Translate free gtx endpoint
 * @param {string} text 
 * @param {string} source 
 * @param {string} target 
 */
async function translateText(text, source, target) {
  const src = source || 'auto';
  const tgt = target || 'en';
  
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(src)}&tl=${encodeURIComponent(tgt)}&dt=t&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Google Translate API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  const translations = [];
  if (data && data[0]) {
    for (let i = 0; i < data[0].length; i++) {
      const item = data[0][i];
      if (item && typeof item[0] === 'string' && typeof item[1] === 'string') {
        const translatedPart = item[0].replace(/\n$/, '').trim();
        const originalPart = item[1].replace(/\n$/, '').trim();
        if (originalPart) {
          translations.push({
            original: originalPart,
            translated: translatedPart
          });
        }
      }
    }
  }

  const detectedSource = data[2] || src;

  return {
    translations,
    detectedSource
  };
}
