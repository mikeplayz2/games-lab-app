const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_DIRECTORIES = 20000;
const MAX_DEPTH = 5;
const MAX_GAMES = 500;
const IGNORED_EXECUTABLE = /^(?:unins|uninstall|setup|install|crash|crashreporter|crashhandler|unitycrashhandler|easyanticheat|eac|battleye|vc_redist|vcredist|dxsetup|redist|updater|update|launcherpatcher)/i;
const IGNORED_DIRECTORIES = new Set([
  "_commonredist", "anti-cheat", "anticheat", "battleye", "crashdumps",
  "easyanticheat", "eac", "redist", "redistributables", "support",
  "system", "system32", "windows"
]);

function friendlyTitle(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function candidateScore(executable, gameTitle) {
  const name = path.basename(executable, path.extname(executable));
  if (IGNORED_EXECUTABLE.test(name)) return -1;
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedTitle = gameTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  let score = 0;
  if (normalizedName === normalizedTitle) score += 12;
  else if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) score += 5;
  if (/^(?:game|win64|win32|shipping|client|main|start|play)$/i.test(name)) score += 3;
  if (/launcher/i.test(name)) score -= 2;
  return score;
}

async function scanGameFolders(roots) {
  const warnings = [];
  const foundGames = new Map();
  let visitedDirectories = 0;

  async function readDirectory(directory) {
    try {
      return await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) {
        if (error.code === "EACCES" || error.code === "EPERM") warnings.push({ path: directory, code: error.code });
        return [];
      }
      throw error;
    }
  }

  async function inspectGameFolder(gameDirectory) {
    const gameTitle = friendlyTitle(path.basename(gameDirectory));
    const candidates = [];
    const pending = [{ directory: gameDirectory, depth: 0 }];

    while (pending.length && visitedDirectories < MAX_DIRECTORIES && foundGames.size < MAX_GAMES) {
      const current = pending.pop();
      visitedDirectories += 1;
      const entries = await readDirectory(current.directory);
      for (const entry of entries) {
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".exe") {
          const executablePath = path.join(current.directory, entry.name);
          const score = candidateScore(executablePath, gameTitle) - current.depth;
          if (score >= 0) candidates.push({ executablePath, score });
        } else if (entry.isDirectory()
          && current.depth < MAX_DEPTH
          && !entry.name.startsWith(".")
          && !IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
          pending.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.executablePath.localeCompare(b.executablePath));
    if (!candidates.length) return;
    const executablePath = path.resolve(candidates[0].executablePath);
    const key = process.platform === "win32" ? executablePath.toLowerCase() : executablePath;
    foundGames.set(key, {
      id: key,
      title: gameTitle,
      executablePath,
      folderPath: gameDirectory,
      source: "folder"
    });
  }

  for (const root of [...new Set(roots.map((value) => path.resolve(value)))]) {
    if (visitedDirectories >= MAX_DIRECTORIES || foundGames.size >= MAX_GAMES) break;
    const entries = await readDirectory(root);
    if (!entries.length) continue;

    const directExecutables = entries.filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".exe");
    const subdirectories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    if (directExecutables.length) await inspectGameFolder(root);
    for (const entry of subdirectories) {
      if (visitedDirectories >= MAX_DIRECTORIES || foundGames.size >= MAX_GAMES) break;
      if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      await inspectGameFolder(path.join(root, entry.name));
    }
  }

  return {
    games: [...foundGames.values()].sort((a, b) => a.title.localeCompare(b.title)),
    warnings,
    visitedDirectories,
    limited: visitedDirectories >= MAX_DIRECTORIES || foundGames.size >= MAX_GAMES
  };
}

module.exports = { scanGameFolders };
