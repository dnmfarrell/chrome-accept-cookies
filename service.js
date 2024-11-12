chrome.webNavigation.onCommitted.addListener(details => {
  if (details.url.startsWith("http")
      && !details.url.includes("chrome.google.com")
      && !details.url.includes("chromewebstore.google.com")
  ) {
    chrome.scripting.executeScript({
      target:{
        tabId: details.tabId,
        allFrames : true
      },
      world: 'MAIN',
      files: ['inject.js'],
      injectImmediately: true
    });
  }
});
