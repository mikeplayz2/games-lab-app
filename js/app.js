import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { getAvatar } from "./profile.js";

const SETTINGS_PREFIX = "games-lab-settings:";
const DEFAULT_SETTINGS = { accent: "blue", compact: false, reduceMotion: false, showMusicControls: true };
const ACCENTS = {
  blue: { color: "#3b82f6", glow: "rgba(59, 130, 246, .28)" },
  violet: { color: "#8b5cf6", glow: "rgba(139, 92, 246, .28)" },
  pink: { color: "#ec4899", glow: "rgba(236, 72, 153, .24)" },
  green: { color: "#10b981", glow: "rgba(16, 185, 129, .24)" }
};

function readSettings(uid) {
  try {
    const stored = JSON.parse(localStorage.getItem(`${SETTINGS_PREFIX}${uid}`) || "{}");
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch (error) {
    console.error("Could not read saved preferences.", error);
    return DEFAULT_SETTINGS;
  }
}

function applySettings(settings) {
  const accent = ACCENTS[settings.accent] || ACCENTS.blue;
  document.documentElement.style.setProperty("--accent", accent.color);
  document.documentElement.style.setProperty("--accent-glow", accent.glow);
  document.documentElement.style.setProperty("--blue", accent.color);
  document.documentElement.style.setProperty("--primary", accent.color);
  document.documentElement.style.setProperty("--primary-light", accent.color);
  document.body.classList.toggle("compact-mode", Boolean(settings.compact));
  document.body.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  window.dispatchEvent(new CustomEvent("games-lab:music-setting-change", {
    detail: Boolean(settings.showMusicControls)
  }));
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  const name = user.displayName?.trim() || user.email?.split("@")[0] || "Player";
  const avatar = getAvatar(user.uid) || user.photoURL || "../assets/logo.png";
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = name;
  });
  document.querySelectorAll("[data-user-avatar]").forEach((element) => {
    element.src = avatar;
  });

  const settings = readSettings(user.uid);
  applySettings(settings);

  const settingsForm = document.getElementById("settings-form");
  if (settingsForm) {
    settingsForm.elements.accent.value = settings.accent;
    settingsForm.elements.compact.checked = Boolean(settings.compact);
    settingsForm.elements.reduceMotion.checked = Boolean(settings.reduceMotion);
    settingsForm.elements.showMusicControls.checked = Boolean(settings.showMusicControls);
    settingsForm.addEventListener("change", () => {
      const next = {
        accent: settingsForm.elements.accent.value,
        compact: settingsForm.elements.compact.checked,
        reduceMotion: settingsForm.elements.reduceMotion.checked,
        showMusicControls: settingsForm.elements.showMusicControls.checked
      };
      try {
        localStorage.setItem(`${SETTINGS_PREFIX}${user.uid}`, JSON.stringify(next));
        applySettings(next);
        document.getElementById("settings-message").textContent = "Your preferences are saved on this browser.";
      } catch (error) {
        document.getElementById("settings-message").textContent = "Preferences could not be saved in this browser.";
        console.error("Could not save preferences.", error);
      }
    });
  }
});

document.querySelectorAll("[data-sign-out]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await signOut(auth);
      window.location.replace("./login.html");
    } catch (error) {
      button.disabled = false;
      const message = document.getElementById("signout-message");
      if (message) message.textContent = error.message || "Could not sign out. Please try again.";
      console.error("Could not sign out.", error);
    }
  });
});
