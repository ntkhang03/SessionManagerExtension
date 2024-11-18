chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("message", message);

  if (message.action === "getStorage") {
    try {
      const localStorageData = { ...localStorage };
      const sessionStorageData = { ...sessionStorage };

      sendResponse({
        localStorage: localStorageData,
        sessionStorage: sessionStorageData
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }

    return true; // Đảm bảo kênh mở cho xử lý async
  } else if (message.action === "activate") {
    console.log("activate");

    // Clear current session data
    localStorage.clear();
    sessionStorage.clear();

    // Restore saved session data from the selected session
    const {
      saveLocalStorage: localStorageData,
      saveSessionStorage: sessionStorageData
    } = message.session;

    for (const key in localStorageData || {}) {
      localStorage.setItem(key, localStorageData[key]);
    }

    for (const key in sessionStorageData || {}) {
      sessionStorage.setItem(key, sessionStorageData[key]);
    }

    console.log("reloaded");
    window.location.reload();
  }
});
