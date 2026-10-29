const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gamesLabDesktop", {
  getAppVersion: () => ipcRenderer.invoke("games-lab:app-version"),
  getUpdateState: () => ipcRenderer.invoke("games-lab:get-update-state"),
  checkForUpdates: () => ipcRenderer.invoke("games-lab:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("games-lab:download-update"),
  installUpdate: () => ipcRenderer.invoke("games-lab:install-update"),
  getMusicState: () => ipcRenderer.invoke("games-lab:get-music-state"),
  controlMusic: (action) => ipcRenderer.invoke("games-lab:control-music", action),
  scanLocalGames: () => ipcRenderer.invoke("games-lab:scan-local-games"),
  addLocalGameFolder: () => ipcRenderer.invoke("games-lab:add-local-game-folder"),
  launchLocalGame: (executablePath) => ipcRenderer.invoke("games-lab:launch-local-game", executablePath),
  onUpdateState: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("games-lab:update-state", listener);
    return () => ipcRenderer.removeListener("games-lab:update-state", listener);
  }
});
