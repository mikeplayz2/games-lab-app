(function () {
  const desktop = window.gamesLabDesktop;
  if (!desktop) return;

  const style = document.createElement("style");
  style.textContent = `
    .desktop-update-toast {
      position: fixed;
      z-index: 10000;
      right: 22px;
      bottom: 96px;
      display: grid;
      width: min(390px, calc(100vw - 32px));
      gap: 10px;
      padding: 18px;
      box-sizing: border-box;
      border: 1px solid rgba(147, 197, 253, .28);
      border-radius: 20px;
      background: rgba(10, 20, 38, .96);
      color: #f8fafc;
      box-shadow: 0 18px 55px rgba(0, 0, 0, .45);
      font: 14px/1.5 "Segoe UI", Arial, sans-serif;
      backdrop-filter: blur(20px);
    }
    .desktop-update-toast[hidden] { display: none; }
    .desktop-update-toast strong { font-size: 15px; }
    .desktop-update-toast p { min-width: 0; margin: 0; color: #b6c4d8; overflow-wrap: anywhere; }
    .desktop-update-error-details { max-width: 100%; }
    .desktop-update-error-details summary { color: #b6c4d8; font-size: 12px; cursor: pointer; }
    .desktop-update-error-details pre {
      max-height: 120px;
      overflow: auto;
      margin: 8px 0 0;
      padding: 9px;
      border-radius: 8px;
      background: rgba(0,0,0,.24);
      color: #aab6cb;
      font: 11px/1.45 Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .desktop-update-toast-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .desktop-update-toast button {
      min-height: 38px;
      padding: 0 13px;
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 10px;
      background: rgba(255,255,255,.07);
      color: white;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .desktop-update-toast button[data-primary] {
      border: 0;
      background: linear-gradient(135deg,#2563eb,#0ea5e9);
    }
    .desktop-update-toast button:disabled { opacity: .6; cursor: wait; }
    .desktop-music-panel {
      position: fixed;
      z-index: 9999;
      right: 22px;
      bottom: 20px;
      display: grid;
      width: min(330px, calc(100vw - 32px));
      gap: 12px;
      padding: 15px;
      box-sizing: border-box;
      border: 1px solid rgba(147, 197, 253, .24);
      border-radius: 20px;
      background: rgba(10, 20, 38, .94);
      color: #f8fafc;
      box-shadow: 0 18px 55px rgba(0, 0, 0, .4);
      font: 13px/1.45 "Segoe UI", Arial, sans-serif;
      backdrop-filter: blur(20px);
    }
    .desktop-music-panel[hidden] { display: none; }
    .desktop-music-heading { display: flex; align-items: center; gap: 9px; color: #b6c4d8; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .desktop-music-disc { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid rgba(255,255,255,.14); border-radius: 9px; background: linear-gradient(145deg,rgba(37,99,235,.45),rgba(14,165,233,.16)); color: white; font-size: 14px; }
    .desktop-music-track { min-width: 0; }
    .desktop-music-track strong, .desktop-music-track span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .desktop-music-track strong { font-size: 14px; }
    .desktop-music-track span { margin-top: 2px; color: #aebbd0; font-size: 12px; }
    .desktop-music-controls { display: flex; justify-content: center; gap: 10px; }
    .desktop-music-controls button {
      display: grid;
      width: 38px;
      height: 36px;
      place-items: center;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 11px;
      background: rgba(255,255,255,.07);
      color: white;
      font: 17px/1 "Segoe UI Symbol", "Segoe UI", sans-serif;
      cursor: pointer;
    }
    .desktop-music-controls button[data-primary] { border: 0; background: linear-gradient(135deg,#2563eb,#0ea5e9); }
    .desktop-music-controls button:disabled { opacity: .45; cursor: default; }
    body.desktop-music-visible .desktop-update-toast { bottom: 170px; }
    @media (max-width: 600px) {
      .desktop-update-toast { right: 16px; bottom: 88px; }
      .desktop-music-panel { right: 16px; bottom: 88px; }
      body.desktop-music-visible .desktop-update-toast { bottom: 235px; }
    }
  `;
  document.head.append(style);

  const toast = document.createElement("section");
  toast.className = "desktop-update-toast";
  toast.hidden = true;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  const heading = document.createElement("strong");
  const description = document.createElement("p");
  const errorDetails = document.createElement("details");
  errorDetails.className = "desktop-update-error-details";
  errorDetails.hidden = true;
  const errorSummary = document.createElement("summary");
  errorSummary.textContent = "Technical details";
  const errorText = document.createElement("pre");
  errorDetails.append(errorSummary, errorText);
  const actions = document.createElement("div");
  actions.className = "desktop-update-toast-actions";
  toast.append(heading, description, errorDetails, actions);
  document.body.append(toast);

  const musicPanel = document.createElement("section");
  musicPanel.className = "desktop-music-panel";
  musicPanel.hidden = true;
  musicPanel.setAttribute("role", "group");
  musicPanel.setAttribute("aria-label", "Now playing controls");
  const musicHeading = document.createElement("div");
  musicHeading.className = "desktop-music-heading";
  const musicDisc = document.createElement("span");
  musicDisc.className = "desktop-music-disc";
  musicDisc.setAttribute("aria-hidden", "true");
  musicDisc.textContent = "♫";
  musicHeading.append(musicDisc, document.createTextNode("Now playing"));
  const musicTrack = document.createElement("div");
  musicTrack.className = "desktop-music-track";
  const musicTitle = document.createElement("strong");
  const musicArtist = document.createElement("span");
  musicTrack.append(musicTitle, musicArtist);
  const musicControls = document.createElement("div");
  musicControls.className = "desktop-music-controls";
  const musicButtons = new Map();
  for (const [action, label, icon] of [
    ["previous", "Previous track", "⏮"],
    ["play-pause", "Play or pause", "⏯"],
    ["next", "Next track", "⏭"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = icon;
    if (action === "play-pause") button.dataset.primary = "true";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        renderMusic(await desktop.controlMusic(action));
      } catch (error) {
        console.error(`Could not ${label.toLowerCase()}.`, error);
        musicTitle.textContent = "Music controls unavailable";
        musicArtist.textContent = "Try again in a moment.";
      } finally {
        button.disabled = false;
      }
    });
    musicButtons.set(action, button);
    musicControls.append(button);
  }
  musicPanel.append(musicHeading, musicTrack, musicControls);
  document.body.append(musicPanel);

  function updateSettingsStatus(state) {
    const status = document.getElementById("desktop-update-status");
    if (!status || !state) return;
    const labels = {
      checking: "Checking for updates...",
      current: `You’re up to date (version ${state.version}).`,
      available: `Version ${state.availableVersion} is available.`,
      downloading: `Downloading update: ${Math.max(0, Math.min(100, state.percent || 0))}%.`,
      downloaded: `Version ${state.availableVersion} is ready to install.`,
      unconfigured: state.userMessage || state.message || "Connect a GitHub release repository to enable updates.",
      error: state.userMessage || "Couldn't check for updates. A release may not be available yet. Check your connection and try again."
    };
    status.textContent = labels[state.status] || "";
  }

  function makeButton(text, handler, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (primary) button.dataset.primary = "true";
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await handler();
      } catch (error) {
        console.error("Desktop app action failed.", error);
        description.textContent = "That action couldn't be completed. Check your connection and try again.";
        button.disabled = false;
      }
    });
    return button;
  }

  function render(state) {
    updateSettingsStatus(state);
    actions.replaceChildren();
    errorDetails.hidden = true;
    errorDetails.open = false;
    errorText.textContent = "";
    toast.hidden = true;
    if (!state || state.status === "idle" || state.status === "current" || state.status === "development" || state.status === "checking") return;

    if (state.status === "available") {
      heading.textContent = `Games Lab ${state.availableVersion} is ready`;
      description.textContent = "Download the update now. It will install when you restart the app.";
      actions.append(makeButton("Download update", () => desktop.downloadUpdate(), true));
    } else if (state.status === "downloading") {
      heading.textContent = "Downloading Games Lab update";
      description.textContent = `${Math.max(0, Math.min(100, state.percent || 0))}% downloaded`;
    } else if (state.status === "downloaded") {
      heading.textContent = "Update downloaded";
      description.textContent = `Games Lab ${state.availableVersion} is ready to install.`;
      actions.append(makeButton("Restart and install", () => desktop.installUpdate(), true));
      actions.append(makeButton("Later", () => {
        toast.hidden = true;
      }));
    } else if (state.status === "checking") {
      heading.textContent = "Checking for updates";
      description.textContent = "Looking for the latest Games Lab release.";
    } else if (state.status === "unconfigured") {
      heading.textContent = "Updates not connected yet";
      description.textContent = state.message || "Set the project’s GitHub release repository to enable updates.";
    } else if (state.status === "error") {
      heading.textContent = "Update check failed";
      description.textContent = state.userMessage || "Couldn't check for updates. A release may not be available yet. Check your connection and try again.";
      if (state.message) {
        errorDetails.hidden = false;
        errorText.textContent = state.message;
      }
      actions.append(makeButton("Try again", () => desktop.checkForUpdates(), true));
      actions.append(makeButton("Dismiss", () => {
        toast.hidden = true;
      }));
    }
    toast.hidden = false;
  }

  desktop.onUpdateState(render);
  desktop.getUpdateState().then(render).catch((error) => {
    console.error("Could not read desktop update status.", error);
  });

  document.querySelectorAll("[data-check-for-updates]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await desktop.checkForUpdates();
      } catch (error) {
        console.error("Could not check for desktop updates.", error);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-app-version]").forEach((element) => {
    desktop.getAppVersion().then((version) => {
      element.textContent = version;
    }).catch((error) => {
      console.error("Could not read app version.", error);
    });
  });

  let musicControlsEnabled = true;
  let musicRequestRunning = false;
  let musicPollTimer;

  function renderMusic(state) {
    if (!musicControlsEnabled || !state || !state.available) {
      musicPanel.hidden = true;
      document.body.classList.remove("desktop-music-visible");
      return;
    }
    musicPanel.hidden = false;
    document.body.classList.add("desktop-music-visible");
    musicTitle.textContent = state.title || "Now playing";
    musicArtist.textContent = [state.artist, state.album].filter(Boolean).join(" · ") || state.source || "System media";
    musicButtons.get("play-pause").disabled = !state.canPlayPause;
    musicButtons.get("previous").disabled = !state.canPrevious;
    musicButtons.get("next").disabled = !state.canNext;
    musicButtons.get("play-pause").textContent = state.status === "Playing" ? "⏸" : "▶";
  }

  async function refreshMusic() {
    if (!musicControlsEnabled || musicRequestRunning) return;
    musicRequestRunning = true;
    let retryDelay = 7000;
    try {
      renderMusic(await desktop.getMusicState());
    } catch (error) {
      console.error("Could not read Windows media controls.", error);
      musicPanel.hidden = !musicControlsEnabled;
      document.body.classList.toggle("desktop-music-visible", musicControlsEnabled);
      musicTitle.textContent = "Music controls unavailable";
      musicArtist.textContent = "Could not read the active media session.";
      retryDelay = 30000;
    } finally {
      musicRequestRunning = false;
      if (musicControlsEnabled) musicPollTimer = window.setTimeout(refreshMusic, retryDelay);
    }
  }

  window.addEventListener("games-lab:music-setting-change", (event) => {
    musicControlsEnabled = event.detail !== false;
    if (musicPollTimer) window.clearTimeout(musicPollTimer);
    if (!musicControlsEnabled) {
      musicPanel.hidden = true;
      return;
    }
    void refreshMusic();
  });
  window.addEventListener("pagehide", () => {
    if (musicPollTimer) window.clearTimeout(musicPollTimer);
  }, { once: true });
  void refreshMusic();
})();
