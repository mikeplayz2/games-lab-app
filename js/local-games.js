(function () {
  const desktop = window.gamesLabDesktop;
  const grid = document.getElementById("local-games-grid");
  const emptyState = document.getElementById("local-empty");
  const count = document.getElementById("local-count");
  const status = document.getElementById("scan-status");
  const search = document.getElementById("local-search");
  const scanButtons = [
    document.getElementById("scan-games"),
    document.getElementById("empty-scan")
  ];
  const folderButtons = [
    document.getElementById("add-folder"),
    document.getElementById("empty-folder")
  ];
  const HIDDEN_GAMES_KEY = "games-lab-hidden-local-games";
  let games = [];
  let hiddenPaths = new Set();
  let isScanning = false;

  function setStatus(message, type = "") {
    status.textContent = message;
    status.classList.toggle("error", type === "error");
    status.classList.toggle("success", type === "success");
  }

  function loadHiddenGames() {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_GAMES_KEY) || "[]");
      if (!Array.isArray(saved) || saved.some((item) => typeof item !== "string")) {
        throw new Error("The hidden local-games list has an invalid format.");
      }
      hiddenPaths = new Set(saved);
    } catch (error) {
      console.error("Could not read the saved local-games list.", error);
      setStatus("The saved hidden-games list could not be read. You can still scan and play games.", "error");
    }
  }

  function visibleGames() {
    const query = search.value.trim().toLowerCase();
    return games.filter((game) => !hiddenPaths.has(game.id)
      && `${game.title} ${game.folderPath}`.toLowerCase().includes(query));
  }

  function createGameCard(game) {
    const card = document.createElement("article");
    card.className = "local-game-card glass";

    const art = document.createElement("div");
    art.className = "local-game-art";
    art.setAttribute("aria-hidden", "true");
    const icon = document.createElement("span");
    icon.className = "local-game-icon";
    icon.textContent = "🎮";
    art.append(icon);

    const body = document.createElement("div");
    body.className = "local-game-body";
    const heading = document.createElement("div");
    heading.className = "local-game-heading";
    const title = document.createElement("h3");
    title.textContent = game.title;
    const badge = document.createElement("span");
    badge.className = "local-game-badge";
    badge.textContent = "Installed";
    heading.append(title, badge);

    const location = document.createElement("p");
    location.className = "local-game-path";
    location.textContent = game.folderPath;
    location.title = game.folderPath;

    const actions = document.createElement("div");
    actions.className = "local-game-actions";
    const play = document.createElement("button");
    play.className = "button";
    play.type = "button";
    play.textContent = "Play game →";
    play.addEventListener("click", async () => {
      play.disabled = true;
      play.textContent = "Opening...";
      try {
        await desktop.launchLocalGame(game.executablePath);
        setStatus(`${game.title} is launching.`, "success");
      } catch (error) {
        console.error(`Could not launch ${game.title}.`, error);
        setStatus(error.message || `Could not launch ${game.title}.`, "error");
      } finally {
        play.disabled = false;
        play.textContent = "Play game →";
      }
    });

    const hide = document.createElement("button");
    hide.className = "button secondary hide-game";
    hide.type = "button";
    hide.textContent = "×";
    hide.title = "Hide this game from your library";
    hide.setAttribute("aria-label", `Hide ${game.title} from your library`);
    hide.addEventListener("click", () => {
      hiddenPaths.add(game.id);
      try {
        localStorage.setItem(HIDDEN_GAMES_KEY, JSON.stringify([...hiddenPaths]));
        renderGames();
        setStatus(`${game.title} was hidden from this library.`, "success");
      } catch (error) {
        hiddenPaths.delete(game.id);
        console.error("Could not save your local-games preferences.", error);
        setStatus("Could not save the hidden-games preference in this browser.", "error");
      }
    });
    actions.append(play, hide);
    body.append(heading, location, actions);
    card.append(art, body);
    return card;
  }

  function renderGames() {
    const visible = visibleGames();
    grid.replaceChildren(...visible.map(createGameCard));
    emptyState.hidden = visible.length > 0;
    document.getElementById("empty-title").textContent = games.length
      ? "No games match that search"
      : "Your local library is waiting";
    document.getElementById("empty-description").textContent = games.length
      ? "Try another search, or scan a game folder to look for more titles."
      : "Scan this computer to find installed games, or choose a folder where you keep your games.";
    count.textContent = games.length
      ? `${visible.length} of ${games.length} installed ${games.length === 1 ? "game" : "games"}`
      : "No local games found yet.";
  }

  function setScanning(scanning) {
    isScanning = scanning;
    for (const button of [...scanButtons, ...folderButtons]) {
      button.disabled = scanning;
    }
    document.getElementById("scan-games").innerHTML = scanning
      ? '<span class="scan-spinner" aria-hidden="true"></span>Scanning...'
      : "⌕ Scan computer";
  }

  async function scanGames() {
    if (!desktop) {
      setStatus("Computer scanning is available in the installed Games Lab app.", "error");
      return;
    }
    if (isScanning) return;
    setScanning(true);
    setStatus("Checking common game libraries and folders on this PC. Nothing is uploaded.");
    count.textContent = "Scanning for installed games...";
    try {
      const result = await desktop.scanLocalGames();
      games = result.games;
      renderGames();
      const notes = [];
      if (result.warnings) notes.push(`${result.warnings} location${result.warnings === 1 ? "" : "s"} could not be checked`);
      if (result.limited) notes.push("scan limit reached; add a specific folder to search further");
      const summary = `${result.games.length} installed ${result.games.length === 1 ? "game" : "games"} found across ${result.scannedFolders} game folders.`;
      setStatus(notes.length ? `${summary} ${notes.join("; ")}.` : summary, result.games.length ? "success" : "");
    } catch (error) {
      console.error("Could not scan local game folders.", error);
      setStatus(error.message || "Could not scan for local games. Try adding a specific game folder.", "error");
      count.textContent = "The game scan could not be completed.";
    } finally {
      setScanning(false);
    }
  }

  async function addFolder() {
    if (!desktop) {
      setStatus("Folder selection is available in the installed Games Lab app.", "error");
      return;
    }
    if (isScanning) return;
    try {
      const result = await desktop.addLocalGameFolder();
      if (!result.canceled) await scanGames();
    } catch (error) {
      console.error("Could not add a local game folder.", error);
      setStatus(error.message || "Could not add that folder. Please try again.", "error");
    }
  }

  loadHiddenGames();
  renderGames();
  search.addEventListener("input", renderGames);
  for (const button of scanButtons) button.addEventListener("click", scanGames);
  for (const button of folderButtons) button.addEventListener("click", addFolder);
  scanGames();
})();
