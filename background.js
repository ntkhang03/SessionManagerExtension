chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "MODIFY_STORAGE") {
    setBadge();
  } else if (message.action === "getCookies") {
    chrome.cookies.getAll({ domain: message.domain }, (cookies) => {
      sendResponse(cookies);
    });
  } else if (message.action === "getSessionData") {
    chrome.storage.local.get(["sessions"], (result) => {
      sendResponse(result.sessions || {});
    });
  } else if (message.action === "setSessionData") {
    chrome.storage.local.set({ sessions: message.data }, () => {
      sendResponse();
    });
  }

  return true;
});

setBadge();
chrome.tabs.onActivated.addListener(setBadge);

chrome.runtime.onInstalled.addListener(() => {
  // Lấy danh sách tất cả các tab đang mở
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      // Inject content.js vào mỗi tab
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content.js"]
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              `Failed to inject script into tab ${tab.id}, domain: ${tab.url}: ${chrome.runtime.lastError.message}`
            );
          }
        }
      );
    }
  });
});

async function setBadge() {
  const thisSiteDomain = await getCurrentSiteDomain();
  const sessions =
    (await chrome.storage.local.get(["sessions"])).sessions || {};
  const sessionsThisSite = sessions[thisSiteDomain] || [];

  if (sessionsThisSite.length === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  } else {
    chrome.action.setBadgeText({ text: sessionsThisSite.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#00f7ff" });
  }
}

// Utility function: Query tabs
async function getTabs(params) {
  return new Promise((resolve) => chrome.tabs.query(params, resolve));
}

async function getCurrentSiteDomain() {
  const tabs = await getTabs({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].url) {
    const url = new URL(tabs[0].url);
    return url.hostname.split(".").slice(-2).join(".");
  }
  return "";
}
