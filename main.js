const { app, BrowserWindow, dialog, ipcMain, Notification, shell } = require("electron");
const { execFile } = require("node:child_process");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { scanGameFolders } = require("./local-games-scanner");
const { githubOwner, githubRepository } = require("./release-config.json");

const APP_HOST = "127.0.0.1";
const APP_ORIGIN = "http://localhost:37142";
const APP_PORT = 37142;
const APP_ROOT = app.getAppPath();
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp"
};
const VALID_GITHUB_VALUE = /^[A-Za-z0-9._-]+$/;
const MEDIA_ACTIONS = new Set(["play-pause", "previous", "next"]);
let mainWindow;
let localServer;
let updateState = { status: "idle", version: app.getVersion() };
const discoveredLocalGames = new Map();

function isTrustedAppFrame(event) {
  return event.sender === mainWindow?.webContents
    && event.senderFrame?.url.startsWith(`${APP_ORIGIN}/`);
}

function addGameLibraryRoots(roots) {
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const systemDrive = process.env.SystemDrive || "C:";
  const driveRoots = [`${systemDrive}\\`];
  const candidates = [
    path.join(programFilesX86, "Steam", "steamapps", "common"),
    path.join(programFiles, "Steam", "steamapps", "common"),
    path.join(programFilesX86, "GOG Galaxy", "Games"),
    path.join(programFiles, "GOG Galaxy", "Games"),
    path.join(programFilesX86, "Origin Games"),
    path.join(programFiles, "EA Games")
  ];

  for (const driveRoot of driveRoots) {
    for (const library of [
      path.join(driveRoot, "SteamLibrary", "steamapps", "common"),
      path.join(driveRoot, "Program Files (x86)", "Steam", "steamapps", "common"),
      path.join(driveRoot, "Program Files", "Steam", "steamapps", "common"),
      path.join(driveRoot, "GOG Games"),
      path.join(driveRoot, "Epic Games"),
      path.join(driveRoot, "EA Games"),
      path.join(driveRoot, "XboxGames"),
      path.join(driveRoot, "Riot Games"),
      path.join(driveRoot, "Ubisoft Game Launcher", "games"),
      path.join(driveRoot, "Games")
    ]) candidates.push(library);
  }

  for (const candidate of candidates) roots.add(path.resolve(candidate));
}

async function readSavedGameFolders() {
  const filePath = path.join(app.getPath("userData"), "local-game-folders.json");
  try {
    const contents = await fsp.readFile(filePath, "utf8");
    const folders = JSON.parse(contents);
    if (!Array.isArray(folders) || folders.some((folder) => typeof folder !== "string")) {
      throw new Error("Saved local game folders have an invalid format.");
    }
    return folders;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function addSavedGameFolder(folderPath) {
  const folders = await readSavedGameFolders();
  const key = folderPath.toLowerCase();
  if (!folders.some((folder) => folder.toLowerCase() === key)) folders.push(folderPath);
  const filePath = path.join(app.getPath("userData"), "local-game-folders.json");
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(folders, null, 2), "utf8");
  return folders;
}

async function addSteamLibraryRoots(roots, warnings) {
  const steamInstallations = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Steam"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Steam"),
    path.join(`${process.env.SystemDrive || "C:"}\\`, "Steam")
  ];

  for (const installation of steamInstallations) {
    const manifestPath = path.join(installation, "steamapps", "libraryfolders.vdf");
    try {
      const contents = await fsp.readFile(manifestPath, "utf8");
      for (const match of contents.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) {
        const libraryPath = match[1].replace(/\\\\/g, "\\").replace(/\\"/g, "\"");
        roots.add(path.join(libraryPath, "steamapps", "common"));
      }
      roots.add(path.join(installation, "steamapps", "common"));
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) throw error;
      if (error.code !== "ENOENT") warnings.push({ path: manifestPath, code: error.code });
    }
  }
}

async function addEpicGameRoots(roots, warnings) {
  const manifests = [
    path.join(process.env.ProgramData || "C:\\ProgramData", "Epic", "EpicGamesLauncher", "Data", "Manifests"),
    path.join(process.env.LOCALAPPDATA || "", "EpicGamesLauncher", "Saved", "Config", "Windows")
  ];

  for (const manifestDirectory of manifests) {
    let entries;
    try {
      entries = await fsp.readdir(manifestDirectory, { withFileTypes: true });
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) throw error;
      if (error.code !== "ENOENT") warnings.push({ path: manifestDirectory, code: error.code });
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".item")) continue;
      const manifestPath = path.join(manifestDirectory, entry.name);
      try {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
        if (typeof manifest.InstallLocation === "string") {
          roots.add(manifest.InstallLocation);
        }
      } catch (error) {
        console.warn("Could not read an Epic Games installation manifest.", manifestPath, error);
        warnings.push({ path: manifestPath, code: "INVALID_MANIFEST" });
      }
    }
  }
}

async function scanForLocalGames() {
  const warnings = [];
  const roots = new Set(await readSavedGameFolders());
  addGameLibraryRoots(roots);
  await addSteamLibraryRoots(roots, warnings);
  await addEpicGameRoots(roots, warnings);
  const result = await scanGameFolders([...roots]);
  warnings.push(...result.warnings);
  discoveredLocalGames.clear();
  for (const game of result.games) discoveredLocalGames.set(game.id, game.executablePath);
  return {
    games: result.games,
    warnings: warnings.length,
    scannedFolders: roots.size,
    visitedDirectories: result.visitedDirectories,
    limited: result.limited
  };
}

function publishUpdateError(error) {
  const message = error && typeof error.message === "string" ? error.message : String(error || "Unknown error");
  const code = error && typeof error.code === "string" ? error.code : "";
  console.error("Games Lab update check failed.", error);
  publishUpdateState("error", {
    code,
    message,
    userMessage: "Couldn't check for updates. A release may not be available yet. Check your connection and try again."
  });
}

function isValidReleaseConfig() {
  return VALID_GITHUB_VALUE.test(githubOwner)
    && githubOwner !== "YOUR_GITHUB_USERNAME"
    && VALID_GITHUB_VALUE.test(githubRepository);
}

function compareNumericVersions(left, right) {
  const parse = (version) => {
    if (typeof version !== "string") return null;
    const match = version.trim().match(/^v?(\d+(?:\.\d+)*)(?:[-+][0-9A-Za-z.-]+)?$/);
    return match ? match[1].split(".").map((part) => part.replace(/^0+(?=\d)/, "")) : null;
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] || "0";
    const rightPart = rightParts[index] || "0";
    if (leftPart.length !== rightPart.length) return leftPart.length > rightPart.length ? 1 : -1;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

function getMediaScriptPath() {
  if (app.isPackaged) {
    return path.join(path.dirname(APP_ROOT), "app.asar.unpacked", "windows-media-controls.ps1");
  }
  return path.join(APP_ROOT, "windows-media-controls.ps1");
}

function runWindowsMediaCommand(action) {
  return new Promise((resolve, reject) => {
    execFile("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      getMediaScriptPath(),
      "-Action",
      action
    ], { windowsHide: true, timeout: 10000, maxBuffer: 128 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr.trim();
        reject(new Error(detail || `Windows media controls failed: ${error.message}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (parseError) {
        reject(new Error(`Windows media controls returned invalid data: ${parseError.message}`));
      }
    });
  });
}

function publishUpdateState(status, details = {}) {
  updateState = { status, version: app.getVersion(), ...details };
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("games-lab:update-state", updateState);
}

function notifyUser(title, body) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on("click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  notification.show();
}

function isTrustedAuthPopup(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "firebaseapp.com"
      || host.endsWith(".firebaseapp.com")
      || host === "google.com"
      || host.endsWith(".google.com")
      || host === "googleapis.com"
      || host.endsWith(".googleapis.com")
      || host === "gstatic.com"
      || host.endsWith(".gstatic.com");
  } catch {
    return false;
  }
}

function openExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "https:" || url.protocol === "mailto:") {
      void shell.openExternal(url.href);
    }
  } catch {
    console.warn("Ignored an invalid external link.");
  }
}

function createLocalServer() {
  localServer = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(new URL(request.url, `http://${APP_HOST}:${APP_PORT}`).pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
      return;
    }

    if (requestPath === "/") {
      response.writeHead(302, { Location: "/pages/dashboard.html", "Cache-Control": "no-store" });
      response.end();
      return;
    }

    const relativePath = requestPath.replace(/^[/\\]+/, "");
    const filePath = path.resolve(APP_ROOT, relativePath);
    const relativeToRoot = path.relative(APP_ROOT, filePath);
    if (!relativeToRoot
      || relativeToRoot === ".."
      || relativeToRoot.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeToRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const appDirectory = relativeToRoot.split(path.sep)[0];
    if (!["assets", "css", "games", "js", "pages"].includes(appDirectory)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500);
        response.end(error.code === "ENOENT" || error.code === "ENOTDIR" ? "Not found" : "Could not read app file");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": content.length,
        "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });

  return new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(APP_PORT, APP_HOST, () => {
      localServer.removeListener("error", reject);
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: "#090c19",
    autoHideMenuBar: true,
    title: "Games Lab",
    icon: path.join(APP_ROOT, "assets", "logo.ico"),
    webPreferences: {
      preload: path.join(APP_ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAuthPopup(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${APP_ORIGIN}/`)) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.once("did-finish-load", () => {
    publishUpdateState(updateState.status, updateState);
  });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  void mainWindow.loadURL(`${APP_ORIGIN}/pages/dashboard.html`);
}

function configureUpdater() {
  if (!app.isPackaged) {
    updateState = { status: "development", version: app.getVersion() };
    return;
  }
  if (!isValidReleaseConfig()) {
    updateState = {
      status: "unconfigured",
      version: app.getVersion(),
      message: "Add your GitHub repository owner in release-config.json before publishing."
    };
    return;
  }

  autoUpdater.setFeedURL({
    provider: "github",
    owner: githubOwner,
    repo: githubRepository,
    releaseType: "release"
  });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => publishUpdateState("checking"));
  autoUpdater.on("update-not-available", () => publishUpdateState("current"));
  autoUpdater.on("update-available", (info) => {
    if (compareNumericVersions(info.version, app.getVersion()) !== 1) {
      publishUpdateState("current");
      return;
    }
    publishUpdateState("available", { availableVersion: info.version });
    notifyUser("Games Lab update available", `Version ${info.version} is ready to download.`);
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState("downloading", { percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState("downloaded", { availableVersion: info.version });
    notifyUser("Games Lab is ready to update", `Version ${info.version} will install when you restart.`);
  });
  autoUpdater.on("error", (error) => {
    publishUpdateError(error);
  });

  autoUpdater.checkForUpdates().catch((error) => {
    publishUpdateError(error);
  });
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      publishUpdateError(error);
    });
  }, 4 * 60 * 60 * 1000).unref();
}

ipcMain.handle("games-lab:get-update-state", () => updateState);
ipcMain.handle("games-lab:check-for-updates", async () => {
  if (!app.isPackaged) {
    publishUpdateState("development", { message: "Update checks are available in the installed app." });
    return updateState;
  }
  if (!isValidReleaseConfig()) {
    publishUpdateState("unconfigured", { message: "Set your GitHub repository in release-config.json first." });
    return updateState;
  }
  try {
    await autoUpdater.checkForUpdates();
    return updateState;
  } catch (error) {
    publishUpdateError(error);
    throw error;
  }
});
ipcMain.handle("games-lab:download-update", async () => {
  if (updateState.status !== "available") {
    throw new Error("There is no available update to download.");
  }
  await autoUpdater.downloadUpdate();
});
ipcMain.handle("games-lab:install-update", () => {
  if (updateState.status !== "downloaded") {
    throw new Error("The update has not finished downloading.");
  }
  autoUpdater.quitAndInstall();
});
ipcMain.handle("games-lab:app-version", () => app.getVersion());
ipcMain.handle("games-lab:get-music-state", async (event) => {
  if (!isTrustedAppFrame(event)) throw new Error("Music controls are available only in the Games Lab app.");
  if (process.platform !== "win32") {
    return { available: false, reason: "unsupported-platform" };
  }
  return runWindowsMediaCommand("get");
});
ipcMain.handle("games-lab:control-music", async (event, action) => {
  if (!isTrustedAppFrame(event)) throw new Error("Music controls are available only in the Games Lab app.");
  if (process.platform !== "win32") throw new Error("System music controls are available on Windows.");
  if (!MEDIA_ACTIONS.has(action)) throw new Error("Choose a supported music control.");
  return runWindowsMediaCommand(action);
});
ipcMain.handle("games-lab:scan-local-games", async (event) => {
  if (!isTrustedAppFrame(event)) throw new Error("Local game scans are available only in the Games Lab app.");
  return scanForLocalGames();
});
ipcMain.handle("games-lab:add-local-game-folder", async (event) => {
  if (!isTrustedAppFrame(event)) throw new Error("Folder selection is available only in the Games Lab app.");
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a folder to scan for games",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  await addSavedGameFolder(path.resolve(result.filePaths[0]));
  return { canceled: false, folder: result.filePaths[0] };
});
ipcMain.handle("games-lab:launch-local-game", async (event, executablePath) => {
  if (!isTrustedAppFrame(event)) throw new Error("Local games can be launched only from the Games Lab app.");
  if (typeof executablePath !== "string" || path.extname(executablePath).toLowerCase() !== ".exe") {
    throw new Error("Choose a discovered Windows game to launch.");
  }
  const key = process.platform === "win32" ? path.resolve(executablePath).toLowerCase() : path.resolve(executablePath);
  const approvedPath = discoveredLocalGames.get(key);
  if (!approvedPath) throw new Error("Scan for installed games before launching one.");
  const file = await fsp.stat(approvedPath);
  if (!file.isFile()) throw new Error("The selected game executable is no longer available.");
  const openError = await shell.openPath(approvedPath);
  if (openError) throw new Error(openError);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await createLocalServer();
    } catch (error) {
      console.error(`Could not start the Games Lab local server on ${APP_HOST}:${APP_PORT}.`, error);
      app.quit();
      return;
    }

    createWindow();
    configureUpdater();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("before-quit", () => {
  if (localServer) localServer.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
