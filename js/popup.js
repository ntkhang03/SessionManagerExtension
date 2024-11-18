document.addEventListener("DOMContentLoaded", async () => {
  // listen when website is loaded
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      await injectContentScript();
    }
  });

  await injectContentScript();

  let thisSiteDomain = await getCurrentSiteDomain();
  let sessionListData = [];

  const sessionList = document.getElementById("session-list");
  const clearSessionButton = document.getElementById("clear-session");
  const addSessionButton = document.getElementById("add-session");
  const sessionModal = new bootstrap.Modal(
    document.getElementById("sessionModal")
  );
  const deleteSessionModal = new bootstrap.Modal(
    document.getElementById("deleteSessionModal")
  );
  const deleteSessionIdInput = document.getElementById("delete-session-id");
  const deleteSessionButton = document.getElementById("delete-session");
  const saveSessionButton = document.getElementById("save-session");
  const saveSessionKeepButton = document.getElementById("save-session-keep");
  const sessionNameInput = document.getElementById("session-name");
  const saveCookiesCheckbox = document.getElementById("save-cookies");
  const saveLocalStorageCheckbox =
    document.getElementById("save-local-storage");
  const saveSessionStorageCheckbox = document.getElementById(
    "save-session-storage"
  );

  let editingSessionId = null;

  // Utility function: Get current site domain
  async function getCurrentSiteDomain() {
    const tabs = await getTabs({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      const url = new URL(tabs[0].url);
      return url.hostname.split(".").slice(-2).join(".");
    }
    return "";
  }

  // Utility function: Query tabs
  async function getTabs(params) {
    return new Promise((resolve) => chrome.tabs.query(params, resolve));
  }

  // Utility function: Execute content script
  async function injectContentScript() {
    const tabs = await getTabs({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["contentScript.js"]
      });
    }
  }

  // Utility function: Clear site storage
  async function clearSiteStorage() {
    const tabs = await getTabs({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          localStorage.clear();
          sessionStorage.clear();
        }
      });
    }
  }

  // Load sessions for the current site
  function loadSessions() {
    chrome.storage.local.get(["sessions"], (result) => {
      sessionListData = (result.sessions || []).filter(
        (s) => s.site === thisSiteDomain
      );
      renderSessionList(sessionListData);
    });
  }

  // Render session list
  function renderSessionList(sessions) {
    sessionList.innerHTML = "";
    sessions.forEach((session, index) => {
      const sessionItem = document.createElement("div");
      sessionItem.className =
        "list-group-item d-flex justify-content-between align-items-center";
      sessionItem.innerHTML = `
        <span>${session.name}</span>
        <div>
          <button class="btn btn-success btn-sm me-2 activate" data-index="${index}">
						<i class="fa fa-check"></i>
						Activate
					</button>
          <button class="btn btn-warning btn-sm me-2 edit" data-index="${index}">
						<i class="fa fa-edit"></i>
						Edit
					</button>
          <button class="btn btn-danger btn-sm delete" data-index="${index}">
						<i class="fa fa-trash"></i>
						Delete
					</button>
        </div>
      `;
      sessionList.appendChild(sessionItem);
    });
  }

  // Get current site cookies
  async function getCurrentCookies() {
    return new Promise((resolve) => {
      chrome.cookies.getAll({ domain: thisSiteDomain }, resolve);
    });
  }

  // Get localStorage and sessionStorage from the site
  async function getCurrentStorage() {
    const tabs = await getTabs({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) return null;

    return new Promise(async (resolve) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "getStorage"
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async function setCookiesForCurrentTab(cookiesArray) {
    // clear all cookies
    const currentCookies = await getCurrentCookies();
    currentCookies.forEach((cookie) => {
      chrome.cookies.remove({
        url: `https://${cookie.domain}`,
        name: cookie.name
      });
    });

    // Set từng cookie
    cookiesArray.forEach((cookie) => {
      // Chuyển domain thành hợp lệ cho cookie
      const cookieUrl = cookie.domain.startsWith(".")
        ? `https://${cookie.domain.substring(1)}`
        : `https://${cookie.domain}`;

      chrome.cookies.set({
        url: cookieUrl,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      });
    });
  }

  // Save session
  async function saveSession() {
    const isKeep = this.id === saveSessionKeepButton.id;
    const name = sessionNameInput.value.trim();
    if (!name) {
      alert("Please enter a name for the session");
      return;
    }

    const sessions =
      (await chrome.storage.local.get(["sessions"])).sessions || [];
    const storageData = await getCurrentStorage();
    const cookies = saveCookiesCheckbox.checked
      ? await getCurrentCookies()
      : null;

    const newSession = {
      site: thisSiteDomain,
      name,
      saveCookies: cookies,
      saveLocalStorage: saveLocalStorageCheckbox.checked
        ? storageData.localStorage
        : null,
      saveSessionStorage: saveSessionStorageCheckbox.checked
        ? storageData.sessionStorage
        : null
    };

    if (editingSessionId !== null) {
      sessions[editingSessionId].name = name;
    } else {
      sessions.push(newSession);
      if (!isKeep) {
        await clearSiteStorage();
        await setCookiesForCurrentTab([]);
      }
    }

    chrome.storage.local.set({ sessions }, () => {
      sessionModal.hide();
      loadSessions();
      if (editingSessionId === null && !isKeep) {
        chrome.tabs.reload();
      }
    });
  }

  // Event: Clear site storage
  clearSessionButton.addEventListener("click", async () => {
    await clearSiteStorage();
    await setCookiesForCurrentTab([]);
    chrome.tabs.reload();
  });

  // Event: Add session
  addSessionButton.addEventListener("click", () => {
    editingSessionId = null;
    sessionNameInput.value = "";
    saveCookiesCheckbox.checked = true;
    saveLocalStorageCheckbox.checked = true;
    saveSessionStorageCheckbox.checked = true;
    sessionModal.show();
  });

  // Event: Save session
  saveSessionButton.addEventListener("click", saveSession);
  saveSessionKeepButton.addEventListener("click", saveSession);

  // Event: Handle session actions
  sessionList.addEventListener("click", async (e) => {
    const tabs = await getTabs({ active: true, currentWindow: true });
    const target = e.target;
    const index = parseInt(target.dataset.index);

    if (target.classList.contains("activate")) {
      const session = sessionListData[index];
      if (session.saveCookies)
        await setCookiesForCurrentTab(session.saveCookies);

      console.log(session);
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "activate",
        session
      });
    } else if (target.classList.contains("edit")) {
      const session = sessionListData[index];
      editingSessionId = index;
      sessionNameInput.value = session.name;
      sessionModal.show();
    } else if (target.classList.contains("delete")) {
      deleteSessionIdInput.value = index;
      deleteSessionModal.show();
    }
  });

  // Event: Delete session
  deleteSessionButton.addEventListener("click", () => {
    const index = parseInt(deleteSessionIdInput.value);
    sessionListData.splice(index, 1);
    chrome.storage.local.set({ sessions: sessionListData }, loadSessions);
    deleteSessionModal.hide();
  });

  loadSessions();
});
