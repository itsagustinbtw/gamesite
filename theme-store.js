(() => {
  const DATABASE_NAME = "agu-games-theme";
  const DATABASE_VERSION = 1;
  const STORE_NAME = "settings";
  const BACKGROUND_KEY = "custom-background";
  const BACKGROUND_MARKER = "indexeddb";
  const STORAGE_KEY = "aguGamesCustomBg";
  let databasePromise;
  let cachedBlob;
  let cachedObjectUrl = "";

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open theme storage."));
      request.onblocked = () => reject(new Error("Theme storage upgrade is blocked by another tab."));
    });
    return databasePromise;
  }

  async function readBackgroundBlob() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(BACKGROUND_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read the saved background."));
    });
  }

  async function writeBackgroundBlob(blob) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(blob, BACKGROUND_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the background."));
      transaction.onabort = () => reject(transaction.error || new Error("Background save was cancelled."));
    });
  }

  async function removeBackgroundBlob() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(BACKGROUND_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not remove the saved background."));
      transaction.onabort = () => reject(transaction.error || new Error("Background removal was cancelled."));
    });
  }

  function objectUrlFor(blob) {
    if (cachedBlob !== blob) {
      if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl);
      cachedBlob = blob;
      cachedObjectUrl = URL.createObjectURL(blob);
    }
    return cachedObjectUrl;
  }

  async function loadBackground() {
    const saved = localStorage.getItem(STORAGE_KEY) || "";
    if (!saved) return "";
    if (saved !== BACKGROUND_MARKER) return saved; // Read older data-URL backgrounds.

    try {
      const blob = await readBackgroundBlob();
      if (blob) return objectUrlFor(blob);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("The saved background could not be opened.", error);
    }
    return "";
  }

  async function saveBackground(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      await writeBackgroundBlob(file);
      localStorage.setItem(STORAGE_KEY, BACKGROUND_MARKER);
      localStorage.setItem("aguGamesThemeVersion", String(Date.now()));
      if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl);
      cachedBlob = file;
      cachedObjectUrl = objectUrl;
      return { url: objectUrl, saved: true };
    } catch (error) {
      console.warn("The background is active for this page but could not be saved.", error);
      return { url: objectUrl, saved: false };
    }
  }

  async function clearBackground() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem("aguGamesThemeVersion", String(Date.now()));
    if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl);
    cachedBlob = null;
    cachedObjectUrl = "";
    try {
      await removeBackgroundBlob();
    } catch (error) {
      console.warn("The saved background data could not be removed.", error);
    }
  }

  window.AguThemeStore = { loadBackground, saveBackground, clearBackground };
})();
