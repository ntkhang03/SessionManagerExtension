(function () {
  const debounceTimers = {};
  const originalFunctions = {
    localStorage: {
      clear: localStorage.clear,
      removeItem: localStorage.removeItem,
      setItem: localStorage.setItem
    },
    sessionStorage: {
      clear: sessionStorage.clear,
      removeItem: sessionStorage.removeItem,
      setItem: sessionStorage.setItem
    }
  };

  let timeIntervalCheckCookie;
  checkAndStartSync();

  function checkAndStartSync() {
    if (localStorage.getItem("SESSION_MANAGER__SYNC_ID")) {
      if (localStorage.getItem("SESSION_MANAGER__AUTO_SYNC_LOCAL_STORAGE")) {
        wrapStorageEvents(localStorage, "localStorageChange");
      }
      if (localStorage.getItem("SESSION_MANAGER__AUTO_SYNC_SESSION_STORAGE")) {
        wrapStorageEvents(sessionStorage, "sessionStorageChange");
      }
      if (localStorage.getItem("SESSION_MANAGER__AUTO_SYNC_COOKIES")) {
        startSyncCookies();
      }
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    switch (event.data.action) {
      case "stopSyncLocalStorage": {
        for (const key in originalFunctions.localStorage) {
          localStorage[key] = originalFunctions.localStorage[key];
        }
        localStorage.removeItem("SESSION_MANAGER__SYNC_ID");
        break;
      }
      case "stopSyncSessionStorage": {
        for (const key in originalFunctions.sessionStorage) {
          sessionStorage[key] = originalFunctions.sessionStorage[key];
        }
        localStorage.removeItem("SESSION_MANAGER__SYNC_ID");
        break;
      }
      case "stopSyncCookies": {
        clearInterval(timeIntervalCheckCookie);
        localStorage.removeItem("SESSION_MANAGER__SYNC_ID");
        break;
      }
      case "stopAllSync": {
        stopAllSync();
        break;
      }
      case "startSyncLocalStorage": {
        wrapStorageEvents(localStorage, "localStorageChange");
        break;
      }
      case "startSyncSessionStorage": {
        wrapStorageEvents(sessionStorage, "sessionStorageChange");
        break;
      }
      case "startSyncCookies": {
        startSyncCookies();
        break;
      }
      case "checkAndStartSync": {
        checkAndStartSync();
        break;
      }
    }
  });

  function stopAllSync() {
    for (const key in originalFunctions.localStorage) {
      localStorage[key] = originalFunctions.localStorage[key];
    }
    for (const key in originalFunctions.sessionStorage) {
      sessionStorage[key] = originalFunctions.sessionStorage[key];
    }
    clearInterval(timeIntervalCheckCookie);
    localStorage.removeItem("SESSION_MANAGER__SYNC_ID");
  }

  function debounce(eventName, callback, delay) {
    if (debounceTimers[eventName]) {
      clearTimeout(debounceTimers[eventName]);
    }

    debounceTimers[eventName] = setTimeout(callback, delay);
  }

  function wrapStorageEvents(storage, eventName) {
    const methodModify = ["clear", "removeItem", "setItem"];
    for (const key of methodModify) {
      const originalFunction = storage[key];
      storage[key] = function (...args) {
        originalFunction.apply(this, args);

        // Just send the last event after 1 second
        debounce(
          eventName,
          () => {
            // send message to content.js
            window.postMessage(
              {
                action: eventName,
                syncId: localStorage.getItem("SESSION_MANAGER__SYNC_ID"),
                data: JSON.parse(JSON.stringify(storage)),
                domain: document.domain
              },
              "*"
            );
          },
          1000
        );
      };
    }
  }

  function startSyncCookies() {
    let previousCookie = document.cookie;
    timeIntervalCheckCookie = setInterval(() => {
      if (document.cookie !== previousCookie) {
        previousCookie = document.cookie;

        window.postMessage(
          // send message to content.js
          {
            action: "cookiesChange",
            syncId: localStorage.getItem("SESSION_MANAGER__SYNC_ID"),
            domain: document.domain
          },
          "*"
        );
      }
    }, 2000);
  }
})();
