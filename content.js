// Get message from content.js
injectModifyStorage();

if (!chrome.runtime || !chrome.runtime.onMessage) {
  console.error("chrome.runtime.onMessage is not supported");
}

try {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      [
        "stopSyncLocalStorage",
        "stopSyncSessionStorage",
        "stopSyncCookies",
        "stopAllSync",
        "startSyncLocalStorage",
        "startSyncSessionStorage",
        "startSyncCookies",
        "stopAllSync",
        "checkAndStartSync"
      ].includes(message.action)
    ) {
      // Send message to injected script (web page)
      window.postMessage(message, "*");
    }
  });
} catch (error) {
  console.error("Failed to add message listener", error);
}

// Get message from injected script (web page)
window.addEventListener("message", async (event) => {
  const sessionsThisSite = await getSessionDataOfDomain(event.data.domain);
  if (sessionsThisSite.length === 0) {
    return;
  }

  if (
    event.source !== window ||
    !event.data ||
    !["localStorageChange", "sessionStorageChange", "cookiesChange"].includes(
      event.data.action
    )
  ) {
    return console.error("[Session Manager] Invalid message", event.data);
  }

  updateSessionData(
    event.data.domain,
    event.data.action,
    event.data.data,
    event.data.syncId
  );
});

function injectModifyStorage() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("assets/js/sessionManager.js");
  script.id = "session-manager-inject";
  (document.head || document.documentElement).appendChild(script);
}

async function getSessionData() {
  try {
    const sessions = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "getSessionData" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    return sessions;
  } catch (error) {
    console.error("Failed to get session data", error);
  }
}

async function getSessionDataOfDomain(domain) {
  if (!domain) {
    return [];
  }

  const sessions = await getSessionData();
  return sessions[domain] || [];
}

async function setSessionData(data) {
  try {
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "setSessionData", data: data },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to set session data", error);
  }
}

async function setSessionDataForDomain(domain, data) {
  if (!domain || !data) {
    return;
  }

  const sessions = await getSessionData();
  sessions[domain] = data;
  return await setSessionData(sessions);
}

// Get current site cookies
async function getCurrentCookies(domain) {
  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "getCookies", domain: domain },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to get current cookies", error);
  }
}

async function updateSessionData(domain, action, data, syncId) {
  const sessionsThisSite = await getSessionDataOfDomain(domain);

  const session = sessionsThisSite.find(
    (s) => s.autoSyncOptions.syncId == syncId
  );

  if (session) {
    if (action === "localStorageChange") {
      session.saveLocalStorage = data;
    } else if (action === "sessionStorageChange") {
      session.saveSessionStorage = data;
    } else if (action === "cookiesChange") {
      session.saveCookies = await getCurrentCookies(domain);
    }

    await setSessionDataForDomain(domain, sessionsThisSite);
  }
}
