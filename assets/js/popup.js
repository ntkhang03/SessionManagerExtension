import cryptoHandler from "./cryptoHandler.js";
import Sortable from "./Sortable.min.js";

document.addEventListener("DOMContentLoaded", async () => {
  const spanCurrentVersion = document.getElementById("span-current-version");
  spanCurrentVersion.innerText = "v" + chrome.runtime.getManifest().version;

  const currentTab = await getCurrentTab();
  if (!currentTab.url.startsWith("http")) {
    const div = document.getElementById("div-content");
    div.innerHTML = `
			<div class="alert alert-danger mb-0" role="alert" style="width: 100%; text-align: center;">
			<strong>!!! WARNING !!!</strong>
			<br />
			Session Manager does not work on this page.
			</div>
		`;

    return;
  }

  // Check if the script is injected
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      return document.getElementById("session-manager-inject") ? true : false;
    }
  });

  if (!result[0].result) {
    const div = document.getElementById("div-content");
    div.innerHTML = `
			<div class="alert alert-danger mb-0" role="alert" style="width: 100%; text-align: center;">
				<strong>!!! WARNING !!!</strong>
				<br />
				Please reload the page to activate Session Manager.
			</div>
		`;

    return;
  }

  // Begin
  const thisSiteDomain = await getCurrentSiteDomain();
  renderSessionList();

  // Modal
  const modalDeleteSelectedSessions = document.getElementById(
    "modal-delete-selected-sessions"
  );
  const modalNewEditSession = document.getElementById("modal-new-edit-session");
  const modalDeleteSession = document.getElementById("modal-delete-session");
  const modalClearCurrentSession = document.getElementById(
    "modal-clear-current-session"
  );
  const modalExportData = document.getElementById("modal-export-data");
  const modalImportData = document.getElementById("modal-import-data");

  const bsModalDeleteSelectedSessions = new bootstrap.Modal(
    modalDeleteSelectedSessions
  );
  const bsModalNewEditSession = new bootstrap.Modal(modalNewEditSession);
  const bsModalDeleteSession = new bootstrap.Modal(modalDeleteSession);
  const bsModalClearCurrentSession = new bootstrap.Modal(
    modalClearCurrentSession
  );
  const bsModalExportData = new bootstrap.Modal(modalExportData);
  const bsModalImportDataModal = new bootstrap.Modal(modalImportData);

  // Inputs
  const inpDeleteSessionId = document.getElementById("inp-delete-session-id");
  const inpSessionName = document.getElementById("inp-session-name");
  const inpPasswordExport = document.getElementById("inp-password-export");
  const inpFileNameExport = document.getElementById("inp-file-name-export");
  const inpFileImportData = document.getElementById("inp-file-import-data");
  const inpPasswordImport = document.getElementById("inp-password-import");
  const inpPasswordHint = document.getElementById("inp-password-hint");

  const pDeleteSessionName = document.getElementById("p-delete-session-name");
  const pDeleteSelectedSessions = document.getElementById("p-delete-selected-sessions");

  const newEditSessionModalLabel = document.getElementById(
    "new-edit-session-modal-label"
  );

  // Buttons
  const btnDeleteSelectedSessions = document.getElementById(
    "btn-delete-selected-sessions"
  );
  const btnSubmitDeleteSelectedSessions = document.getElementById(
    "btn-submit-delete-selected-sessions"
  );
  const btnClearCurrentSession = document.getElementById("btn-clear-current-session");
  const btnSaveCurrentSession = document.getElementById("btn-save-current-session");
  const btnSubmitDeleteSession = document.getElementById("btn-submit-delete-session");
  const btnSubmitSaveSession = document.getElementById("btn-submit-save-session");
  const btnSubmitSaveSessionKeep = document.getElementById(
    "btn-submit-save-session-keep"
  );
  const btnSubmitClearCurrentSession = document.getElementById(
    "btn-submit-clear-current-session"
  );
  const btnOpenModalExportData = document.getElementById("btn-open-modal-export-data");
  const btnOpenModalImportData = document.getElementById("btn-open-modal-import-data");
  const btnExportData = document.getElementById("btn-export-data");
  const btnImportData = document.getElementById("btn-import-data");

  // Checkboxes
  // chk-select-all
  const chkSelectAll = document.getElementById("chk-select-all");
  const chkSaveCookies = document.getElementById("chk-save-cookies");
  const chkSaveLocalStorage = document.getElementById("chk-save-local-storage");
  const chkSaveSessionStorage = document.getElementById("chk-save-session-storage");
  const chkAutoSyncCookies = document.getElementById("chk-auto-sync-cookies");
  const chkAutoSyncLocalStorage = document.getElementById("chk-auto-sync-local-storage");
  const chkAutoSyncSessionStorage = document.getElementById(
    "chk-auto-sync-session-storage"
  );

  // Other elements
  const divSessionActions = document.getElementById("div-session-actions");
  const divDragAndDropText = document.getElementById("div-drag-drop");
  const divSessionList = document.getElementById("div-session-list");
  const divSessionListEmpty = document.getElementById("div-empty-session");
  const spanPasswordHint = document.getElementById("span-password-hint");

  let editingSessionIndex = null;

  // Event: Clear current session
  btnClearCurrentSession.addEventListener("click", async () => {
    bsModalClearCurrentSession.show();
  });

  // Event: Add session
  btnSaveCurrentSession.addEventListener("click", handleAddNewSession);

  // Event: Save session
  btnSubmitSaveSession.addEventListener("click", saveSession);
  btnSubmitSaveSessionKeep.addEventListener("click", saveSession);

  // Event: Clear current session
  btnSubmitClearCurrentSession.addEventListener(
    "click",
    clearSessionAndReloadTab
  );

  // Drag and drop
  let isDisableDragAndDrop = false;
  new Sortable(divSessionList, {
    handle: ".list-group-item",
    animation: 150,

    onEnd: async function (evt) {
      // temp disable drag and drop
      if (isDisableDragAndDrop) {
        return;
      }

      isDisableDragAndDrop = true;

      const newIndex = evt.newIndex;
      const oldIndex = evt.oldIndex;

      const sessionDataThisSite = await getSessionDataOfDomain(thisSiteDomain);
      // swap the position of 2 elements in the array
      const temp = sessionDataThisSite[oldIndex];
      sessionDataThisSite[oldIndex] = sessionDataThisSite[newIndex];
      sessionDataThisSite[newIndex] = temp;
      await setSessionDataForDomain(thisSiteDomain, sessionDataThisSite);

      isDisableDragAndDrop = false;
    }
  });

  divSessionList.addEventListener("click", handleSessionActionClick);

  // Event: Open modal export
  btnOpenModalExportData.addEventListener(
    "click",
    handleOpenModalExportDataClick
  );

  // Event: Delete session
  btnSubmitDeleteSession.addEventListener("click", handleDeleteSessionClick);

  // Event: Import data
  btnOpenModalImportData.addEventListener("click", () => {
    inpFileImportData.value = "";
    bsModalImportDataModal.show();
  });

  // Event: Export data
  btnExportData.addEventListener("click", handleExportDataClick);

  // Event: Import data
  btnImportData.addEventListener("click", handleImportDataClick);

  // Event: inpPasswordExport change
  inpPasswordExport.addEventListener("input", handlePasswordExportInput);

  // Event: inpFileImportData change
  inpFileImportData.addEventListener("change", handleFileImportChange);

  chkSelectAll.addEventListener("change", handleSelectAllChange);

  chkSaveCookies.addEventListener("change", function () {
    chkAutoSyncCookies.disabled = !this.checked;
  });

  chkSaveLocalStorage.addEventListener("change", function () {
    chkAutoSyncLocalStorage.disabled = !this.checked;
  });

  chkSaveSessionStorage.addEventListener("change", function () {
    chkAutoSyncSessionStorage.disabled = !this.checked;
  });

  document.addEventListener("click", updateSelectAllState);

  btnDeleteSelectedSessions.addEventListener(
    "click",
    handleDeleteSelectedSessions
  );
  btnSubmitDeleteSelectedSessions.addEventListener(
    "click",
    submitDeleteSelectedSessions
  );

  document.querySelectorAll(".modal").forEach(setupModalEventListeners);

  // when reload success, enable all activate buttons
  chrome.tabs.onUpdated.addListener(function () {
    renderSessionList();
  });

  // ================== UTILITY FUNCTIONS ================== //
  // Render session list
  async function renderSessionList() {
		console.log(thisSiteDomain);
		console.log(await getSessionData());
    const sessions = await getSessionDataOfDomain(thisSiteDomain);
		console.log(sessions);
    const storageData = await getCurrentStorage();
    divSessionList.innerHTML = "";
    if (sessions.length === 0) {
      divSessionActions.classList.add("d-none");
      divSessionListEmpty.classList.remove("d-none");
      divSessionList.classList.add("d-none");
      divDragAndDropText.classList.add("d-none");
      return;
    } else {
      divSessionActions.classList.remove("d-none");
      divSessionListEmpty.classList.add("d-none");
      divSessionList.classList.remove("d-none");
      divDragAndDropText.classList.remove("d-none");
    }

    sessions.forEach((session, index) => {
      const sessionItem = document.createElement("div");
      sessionItem.className =
        "list-group-item d-flex justify-content-between align-items-center";

      sessionItem.draggable = true;
      sessionItem.innerHTML = `
				<div class="d-flex align-items-center form-check">
					<input id="select-session-${index}" type="checkbox" class="form-check-input me-2 select-session" data-index="${index}">
					<label for="select-session-${index}" class="form-check-label me-2">${session.name}</label>
				</div>
				<div>
					<button class="btn btn-success btn-sm me-2 activate" data-index="${index}">
						<i class="fa fa-check"></i>
						${storageData?.localStorage?.["SESSION_MANAGER__USE_SESSION_INDEX"] === index.toString() ? "Activated" : "Activate"}
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
      divSessionList.appendChild(sessionItem);
    });
  }

  // Get current site cookies
  async function getCurrentCookies(domain = thisSiteDomain) {
    return new Promise((resolve) => {
      chrome.cookies.getAll({ domain }, resolve);
    });
  }

  // Get localStorage and sessionStorage from the site
  async function getCurrentStorage() {
    const tab = await getCurrentTab();
    if (!tab) {
      return null;
    }

    return new Promise(async (resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => {
            return {
              localStorage: { ...localStorage },
              sessionStorage: { ...sessionStorage }
            };
          }
        },
        (results) => {
          resolve(results[0].result);
        }
      );
    });
  }

  async function setCookiesForCurrentTab(cookiesArray) {
    // clear all current cookies
    const currentCookies = await getCurrentCookies();
    currentCookies.forEach((cookie) => {
      chrome.cookies.remove({
        url: `https://${cookie.domain}`,
        name: cookie.name
      });
    });

    // Set each cookie
    cookiesArray.forEach((cookie) => {
      // Convert domain to valid for cookie
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
    const isKeep = this.id === btnSubmitSaveSessionKeep.id;
    const name = inpSessionName.value.trim();
    if (!name) {
      toastNotification("Please enter a name for the session");
      return;
    }

    const sessionDataThisSite = await getSessionDataOfDomain(thisSiteDomain);
    const autoSyncOptions = {
      autoSyncCookies: chkAutoSyncCookies.checked,
      autoSyncLocalStorage: chkAutoSyncLocalStorage.checked,
      autoSyncSessionStorage: chkAutoSyncSessionStorage.checked,
      syncId: null
    };

    let syncId;
    let sessionEdit;
    if (editingSessionIndex !== null) {
      sessionEdit = sessionDataThisSite[editingSessionIndex];
      syncId = sessionEdit.autoSyncOptions.syncId;
    }

    if (!syncId) {
      syncId = [...Array(32)]
        .map(() => (~~(Math.random() * 36)).toString(36))
        .join("");
    }
    autoSyncOptions.syncId = syncId;

    const tabs = await chrome.tabs.query({
      url: `*://${editingSessionIndex !== null ? sessionEdit.site : thisSiteDomain}/*`
    });

    tabs.forEach((tab) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (syncId, autoSyncOptions) => {
          if (
            !autoSyncOptions.autoSyncCookies &&
            !autoSyncOptions.autoSyncLocalStorage &&
            !autoSyncOptions.autoSyncSessionStorage
          ) {
            return;
          }

          localStorage.setItem("SESSION_MANAGER__SYNC_ID", syncId);

          if (autoSyncOptions.autoSyncCookies) {
            localStorage.setItem("SESSION_MANAGER__AUTO_SYNC_COOKIES", "true");
          } else {
            localStorage.removeItem("SESSION_MANAGER__AUTO_SYNC_COOKIES");
          }

          if (autoSyncOptions.autoSyncLocalStorage) {
            localStorage.setItem(
              "SESSION_MANAGER__AUTO_SYNC_LOCAL_STORAGE",
              "true"
            );
          } else {
            localStorage.removeItem("SESSION_MANAGER__AUTO_SYNC_LOCAL_STORAGE");
          }

          if (autoSyncOptions.autoSyncSessionStorage) {
            localStorage.setItem(
              "SESSION_MANAGER__AUTO_SYNC_SESSION_STORAGE",
              "true"
            );
          } else {
            localStorage.removeItem(
              "SESSION_MANAGER__AUTO_SYNC_SESSION_STORAGE"
            );
          }

          // reload page
          location.reload();
        },
        args: [syncId, autoSyncOptions]
      });
    });

    if (
      !autoSyncOptions.autoSyncCookies &&
      !autoSyncOptions.autoSyncLocalStorage &&
      !autoSyncOptions.autoSyncSessionStorage
    ) {
      delete autoSyncOptions.syncId;
    }

    const storageData = await getCurrentStorage();
    const cookies = chkSaveCookies.checked ? await getCurrentCookies() : null;

    const newSession = {
      site: thisSiteDomain,
      name,
      saveCookies: chkSaveCookies.checked ? cookies : null,
      saveLocalStorage: chkSaveLocalStorage.checked
        ? storageData.localStorage
        : null,
      saveSessionStorage: chkSaveSessionStorage.checked
        ? storageData.sessionStorage
        : null,
      autoSyncOptions
    };

    if (editingSessionIndex !== null) {
      sessionDataThisSite[editingSessionIndex] = newSession;
    } else {
      sessionDataThisSite.push(newSession);
      if (!isKeep) {
        await clearSiteStorage();
        await setCookiesForCurrentTab([]);
        // reload all tabs
        for (const tab of tabs) {
          chrome.tabs.reload(tab.id);
        }
      }
    }

		console.log(sessionDataThisSite);
    await setSessionDataForDomain(thisSiteDomain, sessionDataThisSite);
    bsModalNewEditSession.hide();
    renderSessionList();

    if (editingSessionIndex !== null || isKeep) {
      // set index to local storage
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: (index) => {
          localStorage.setItem("SESSION_MANAGER__USE_SESSION_INDEX", index);
        },
        args: [sessionDataThisSite.length - 1]
      });
    }

    editingSessionIndex = null;
    renderSessionList();

    // send message to background.js
    chrome.runtime.sendMessage({ action: "MODIFY_STORAGE" });
  }

  async function activateSession(tab, session, index) {
    const {
      saveCookies,
      saveLocalStorage = {},
      saveSessionStorage = {}
    } = session;

    if (saveCookies) {
      await setCookiesForCurrentTab(saveCookies);
    }

    return new Promise(async (resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: (saveLocalStorage, saveSessionStorage, isUseSessionIndex) => {
            localStorage.clear();
            sessionStorage.clear();

            for (const key in saveLocalStorage) {
              localStorage.setItem(key, saveLocalStorage[key]);
            }

            for (const key in saveSessionStorage) {
              sessionStorage.setItem(key, saveSessionStorage[key]);
            }

            localStorage.setItem(
              "SESSION_MANAGER__USE_SESSION_INDEX",
              isUseSessionIndex
            );
          },
          args: [saveLocalStorage, saveSessionStorage, index]
        },
        resolve
      );
    });
  }

  // ========= HANDLE FUNCTION ========= //
  function handleAddNewSession() {
    editingSessionIndex = null;
    inpSessionName.value = "";
    chkSaveCookies.checked = true;
    chkSaveLocalStorage.checked = true;
    chkSaveSessionStorage.checked = true;
    newEditSessionModalLabel.innerText = "Add new session";
    modalNewEditSession.querySelectorAll("input").forEach((input) => {
      input.disabled = false;
    });

    btnSubmitSaveSessionKeep.classList.remove("d-none");
    bsModalNewEditSession.show();
  }

  async function clearSessionAndReloadTab() {
    await clearSiteStorage();
    await setCookiesForCurrentTab([]);
    chrome.tabs.reload();
    bsModalClearCurrentSession.hide();
  }

  async function handleSessionActionClick(e) {
    const tab = await getCurrentTab();
    const target = e.target;
    const index = parseInt(target.dataset.index);
    const sessionDataThisSite = await getSessionDataOfDomain(thisSiteDomain);

    if (target.classList.contains("activate")) {
      const activateButtons = divSessionList.querySelectorAll(".activate");
      activateButtons.forEach((button) => {
        button.disabled = true;
        if (button == target) {
          button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Activating';
        }
      });

      await activateSession(tab, sessionDataThisSite[index], index);
      chrome.tabs.reload();
    } else if (target.classList.contains("edit")) {
      const session = sessionDataThisSite[index];
      editingSessionIndex = index;
      inpSessionName.value = session.name;
      if (session.autoSyncOptions?.syncId) {
        const actions = {
          autoSyncCookies: chkAutoSyncCookies,
          autoSyncLocalStorage: chkAutoSyncLocalStorage,
          autoSyncSessionStorage: chkAutoSyncSessionStorage
        };
        for (const key in actions) {
          actions[key].checked = !!session.autoSyncOptions[key];
        }
      }
      newEditSessionModalLabel.innerText = "Edit session";
      btnSubmitSaveSessionKeep.classList.add("d-none");
      bsModalNewEditSession.show();
    } else if (target.classList.contains("delete")) {
      inpDeleteSessionId.value = index;
      pDeleteSessionName.innerHTML = `Are you sure you want to delete the session <strong>${sessionDataThisSite[index].name}</strong>? This action cannot be undone.`;
      bsModalDeleteSession.show();
    }
  }

  async function handleDeleteSessionClick() {
    const index = parseInt(inpDeleteSessionId.value);
    const sessionDataThisSite = await getSessionDataOfDomain(thisSiteDomain);
    sessionDataThisSite.splice(index, 1);
    await setSessionDataForDomain(thisSiteDomain, sessionDataThisSite);
    renderSessionList();

    bsModalDeleteSession.hide();

    // send message to background.js
    chrome.runtime.sendMessage({ action: "MODIFY_STORAGE" });
  }

  function handleOpenModalExportDataClick() {
    inpFileNameExport.value = `sessionsManger_${new Date().toISOString().split("T")[0]}.json`;
    bsModalExportData.show();
  }

  async function handleExportDataClick() {
    const password = inpPasswordExport.value.trim();
    if (inpFileNameExport.value.split(".").pop() !== "json") {
      toastNotification("Invalid file extension, please use .json");
    }

    // password is optional
    let url = "";
    const sessionData = await getSessionData();

    if (password) {
      const encryptedData = await cryptoHandler.encrypt(
        JSON.stringify(sessionData),
        password
      );
      const blob = new Blob(
        [
          JSON.stringify({
            dataProtection: encryptedData,
            passwordHint: inpPasswordHint.value.trim() || ""
          })
        ],
        {
          type: "application/json"
        }
      );
      url = URL.createObjectURL(blob);
    } else {
      const blob = new Blob([JSON.stringify(sessionData)], {
        type: "application/json"
      });
      url = URL.createObjectURL(blob);
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = inpFileNameExport.value;
    a.click();
    bsModalExportData.hide();
  }

  async function handleImportDataClick() {
    const file = inpFileImportData.files[0];
    const password = inpPasswordImport.value.trim();
    if (!file) {
      toastNotification("Please select a file to import");
      return;
    }

    // check is json file
    if (file.type !== "application/json") {
      toastNotification("Invalid file type, please select a JSON file");
      inpFileImportData.value = "";
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async (e) => {
      const data = JSON.parse(e.target.result);
      let dataResult;

      if (password) {
        try {
          const decryptedData = await cryptoHandler.decrypt(
            data.dataProtection,
            password
          );
          dataResult = JSON.parse(decryptedData);
        } catch (error) {
          toastNotification("Invalid password");
          console.error(error);
          inpFileImportData.value = "";
          return;
        }
      } else {
        dataResult = data;
      }

      try {
        await setSessionData(dataResult);
        const totalSession = Object.values(dataResult).reduce(
          (acc, val) => acc + val.length,
          0
        );
        toastNotification(
          `Loaded ${totalSession} sessions for ${Object.keys(dataResult).length} sites`
        );
        renderSessionList();

        bsModalImportDataModal.hide();
        inpFileImportData.value = "";
        inpPasswordImport.value = "";
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        inpPasswordImport.value = "";
      }
    };
  }

  async function handlePasswordExportInput() {
    if (inpPasswordExport.value.trim()) {
      inpPasswordHint.parentElement.classList.remove("d-none");
    } else {
      inpPasswordHint.parentElement.classList.contains("d-none")
        ? null
        : inpPasswordHint.parentElement.classList.add("d-none");
    }
  }

  async function handleFileImportChange() {
    if (inpFileImportData.files.length > 0) {
      // check file type
      const file = inpFileImportData.files[0];
      if (file.type !== "application/json") {
        toastNotification("Invalid file type, please select a JSON file");
        inpFileImportData.value = "";
        return;
      }

      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = (e) => {
        let data;
        try {
          data = JSON.parse(e.target.result);
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          toastNotification("Invalid file format, please select a valid file");
          inpFileImportData.value = "";
          return;
        }

        try {
          if (data.dataProtection) {
            inpPasswordImport.parentElement.classList.remove("d-none");
            spanPasswordHint.innerText = data.passwordHint || "(No hint)";
            spanPasswordHint.parentElement.classList.remove("d-none");

            if (
              !data.dataProtection.iv ||
              !data.dataProtection.salt ||
              !data.dataProtection.encryptedData
            ) {
              toastNotification(
                "Invalid file format, please select a valid file"
              );
              inpFileImportData.value = "";
              return;
            }
          } else {
            inpPasswordImport.parentElement.classList.add("d-none");
            spanPasswordHint.parentElement.classList.add("d-none");

            if (
              // check is object
              (typeof data !== "object" && !Array.isArray(data)) ||
              Object.values(data)
                .flat()
                .some((d) => !isValidSessionData(d))
            ) {
              toastNotification(
                "Invalid file format, please select a valid file"
              );
              inpFileImportData.value = "";
              return;
            }
          }
        } catch (error) {
          console.error(error);
          toastNotification(
            "An error occurred while reading the file, check console for more details"
          );
        }
      };
    }
  }

  function handleSelectAllChange() {
    const checkboxes = document.querySelectorAll(".select-session");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = this.checked;
    });
    btnDeleteSelectedSessions.disabled = !this.checked;
  }

  function updateSelectAllState(e) {
    if (e.target.classList.contains("select-session")) {
      const totalChecked = document.querySelectorAll(
        ".select-session:checked"
      ).length;
      chkSelectAll.checked = totalChecked === divSessionList.children.length;
      // check for set Indeterminate
      chkSelectAll.indeterminate =
        totalChecked > 0 && totalChecked < divSessionList.children.length;
      btnDeleteSelectedSessions.disabled = totalChecked === 0;
    }
  }

  function handleDeleteSelectedSessions() {
    const checkboxes = document.querySelectorAll(".select-session:checked");
    if (checkboxes.length === 0) {
      toastNotification("Please select at least one session to delete");
      return;
    }

    const indexes = Array.from(checkboxes).map((checkbox) =>
      parseInt(checkbox.dataset.index)
    );

    pDeleteSelectedSessions.innerHTML = `Are you sure you want to delete <strong>${indexes.length}</strong> selected sessions? This action cannot be undone.`;
    bsModalDeleteSelectedSessions.show();
  }

  async function submitDeleteSelectedSessions() {
    const checkboxes = document.querySelectorAll(".select-session:checked");
    const indexes = Array.from(checkboxes).map((checkbox) =>
      parseInt(checkbox.dataset.index)
    );

    const sessionDataThisSite = await getSessionDataOfDomain(thisSiteDomain);
    indexes.sort((a, b) => b - a);
    indexes.forEach((index) => {
      sessionDataThisSite.splice(index, 1);
    });

    await setSessionDataForDomain(thisSiteDomain, sessionDataThisSite);
    renderSessionList();
    bsModalDeleteSelectedSessions.hide();

    // send message to background.js
    chrome.runtime.sendMessage({ action: "MODIFY_STORAGE" });
  }

  function setupModalEventListeners(modal) {
    modal.addEventListener("show.bs.modal", () => {
      // check if current minHeight is less than 33rem
      // convert rem to px
      const minHeightPx =
        34 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (document.body.clientHeight < minHeightPx) {
        document.body.style.minHeight = `${minHeightPx}px`;
      }
    });

    modal.addEventListener("shown.bs.modal", () => {
      inpSessionName.focus();
    });

    modal.addEventListener("hidden.bs.modal", () => {
      document.body.style.minHeight = ""; // Reset height when modal closes
    });
  }
});

function toastNotification(message) {
  const snackbar = document.getElementById("snackbar");
  snackbar.addEventListener("click", function () {
    snackbar.className = snackbar.className.replace("show", "");
  });
  snackbar.innerHTML = message;
  snackbar.className = "show";
  setTimeout(function () {
    snackbar.className = snackbar.className.replace("show", "");
  }, 3000);
}

async function getSessionData() {
  return (await chrome.storage.local.get(["sessions"])).sessions || {};
}

async function getSessionDataOfDomain(domain) {
  if (!domain) {
    return [];
  }

  const sessions = await getSessionData();
  return sessions[domain] || [];
}

async function setSessionData(data) {
  return await chrome.storage.local.set({ sessions: data });
}

async function setSessionDataForDomain(domain, data) {
  if (!domain || !data) {
    return;
  }

  const sessions = await getSessionData();
  sessions[domain] = data;
  return await setSessionData(sessions);
}

function isValidSessionData(data) {
  const keys = Object.keys(data);
  return (
    keys.includes("name") &&
    keys.includes("site") &&
    keys.includes("saveCookies") &&
    keys.includes("saveLocalStorage") &&
    keys.includes("saveSessionStorage")
  );
}

// Utility function: Get current site domain
async function getCurrentSiteDomain() {
  const tab = await getCurrentTab();
  if (tab.url) {
    const url = new URL(tab.url);
    return url.hostname.split(".").slice(-2).join(".");
  }
  return "";
}

// Utility function: Get current tab
async function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs.length > 0 ? tabs[0] : null);
    });
  });
}

// Utility function: Clear site storage
async function clearSiteStorage() {
  return new Promise(async (resolve) => {
    const tab = await getCurrentTab();
    if (tab) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => {
            localStorage.clear();
            sessionStorage.clear();
          }
        },
        () => {
          resolve();
        }
      );
    }
  });
}
