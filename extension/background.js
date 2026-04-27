// Background script for Aawazz extension
// Listens for extension icon click and injects content.js into active tab

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Inject content.js into current active tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    console.log('Aawazz content script injected successfully into tab:', tab.id);
  } catch (error) {
    console.error('Error injecting content script:', error);
  }
});
