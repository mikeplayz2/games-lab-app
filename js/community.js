import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { getAvatar } from "./profile.js";

const ADMIN_UID = "Ie1phoxgUOWEs8KOj32LD5mmj0M2";
const MAX_HTML_LENGTH = 20000;
const FIRESTORE_TIMEOUT_MS = 15000;
const DEFAULT_AVATAR = "../assets/logo.png";
const communityGames = collection(db, "communityGames");
const communityProfiles = collection(db, "communityProfiles");
const gameGrid = document.getElementById("community-grid");
const gameSearch = document.getElementById("community-search");
const submitForm = document.getElementById("submission-form");
const sourceRadios = [...document.querySelectorAll('input[name="source-kind"]')];
const urlField = document.getElementById("url-field");
const htmlField = document.getElementById("html-field");
const gameDialog = document.getElementById("game-dialog");
const gameFrame = document.getElementById("game-frame");
const openGameLink = document.getElementById("open-game-link");
let activeUser = null;
let profile = null;
let publicGames = [];
let ownGames = [];
let profiles = new Map();
let isAdmin = false;
let publicGeneration = 0;
let stopPublicGames = () => {};
let stopOwnGames = () => {};
let pendingSubmission = null;

function waitForFirestore(operation, timeoutMessage) {
  let timeoutId;
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const error = new Error(timeoutMessage);
        error.code = "timeout";
        reject(error);
      }, FIRESTORE_TIMEOUT_MS);
    })
  ]).finally(() => window.clearTimeout(timeoutId));
}

function setMessage(elementId, text, type = "") {
  const element = document.getElementById(elementId);
  element.textContent = text;
  element.classList.toggle("error", type === "error");
  element.classList.toggle("success", type === "success");
}

function friendlyError(error, context) {
  console.error(context, error);
  if (error.code === "permission-denied") {
    return "Community storage needs its Firestore rules configured. Ask the project owner to publish firestore.rules.";
  }
  if (error.code === "unavailable" || error.code === "failed-precondition") {
    return "Community games aren't available right now. Check your connection and try again.";
  }
  if (error.code === "timeout") return error.message;
  return "That community action couldn't be completed. Please try again.";
}

function profilePhoto(value) {
  if (typeof value !== "string") return DEFAULT_AVATAR;
  if (value.startsWith("https://") || value.startsWith("data:image/jpeg;base64,")) return value;
  return DEFAULT_AVATAR;
}

function getDisplayName(user) {
  return (user.displayName || user.email?.split("@")[0] || "Games Lab player").trim().slice(0, 40);
}

async function saveCommunityProfile(user) {
  const localAvatar = getAvatar(user.uid);
  const photoUrl = profilePhoto(localAvatar || user.photoURL);
  const publicProfile = {
    uid: user.uid,
    displayName: getDisplayName(user),
    photoUrl: photoUrl === DEFAULT_AVATAR ? "" : photoUrl,
    updatedAt: serverTimestamp()
  };
  await waitForFirestore(
    setDoc(doc(communityProfiles, user.uid), publicProfile, { merge: true }),
    "Saving your creator profile is taking too long. Check your connection and try publishing again."
  );
  profiles.set(user.uid, { ...publicProfile, photoUrl: photoUrl === DEFAULT_AVATAR ? "" : photoUrl });
  return publicProfile;
}

async function getCreatorProfile(game) {
  if (profiles.has(game.ownerUid)) return profiles.get(game.ownerUid);
  const creator = {
    displayName: game.creatorName || "Games Lab player",
    photoUrl: game.creatorPhoto || ""
  };
  try {
    const snapshot = await getDoc(doc(communityProfiles, game.ownerUid));
    if (snapshot.exists()) {
      const data = snapshot.data();
      creator.displayName = typeof data.displayName === "string" ? data.displayName : creator.displayName;
      creator.photoUrl = typeof data.photoUrl === "string" ? data.photoUrl : creator.photoUrl;
    }
  } catch (error) {
    console.warn("Could not load a community creator profile.", error);
  }
  creator.photoUrl = profilePhoto(creator.photoUrl);
  profiles.set(game.ownerUid, creator);
  return creator;
}

function sourceModeChanged() {
  const sourceMode = submitForm.elements["source-kind"].value;
  const useHtml = sourceMode === "html";
  urlField.hidden = useHtml;
  htmlField.hidden = !useHtml;
  document.getElementById("game-url").required = !useHtml;
  document.getElementById("game-html").required = useHtml;
}

function gameDocumentHTML(source) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src https: data: blob:; script-src \'unsafe-inline\' \'unsafe-eval\' https: data: blob:; style-src \'unsafe-inline\' https: data:; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'none\'">';
  const securityHead = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${policy}`;
  if (/<head\b[^>]*>/i.test(source)) {
    return source.replace(/<head\b[^>]*>/i, (head) => `${head}${securityHead}`);
  }
  if (/<html\b[^>]*>/i.test(source)) {
    return source.replace(/<html\b[^>]*>/i, (html) => `${html}<head>${securityHead}</head>`);
  }
  return `<!doctype html><html><head>${securityHead}</head><body>${source}</body></html>`;
}

function createCreator(game, creator) {
  const wrapper = document.createElement("div");
  wrapper.className = "creator";
  const avatar = document.createElement("img");
  avatar.src = profilePhoto(creator.photoUrl);
  avatar.alt = "";
  avatar.loading = "lazy";
  avatar.addEventListener("error", () => { avatar.src = DEFAULT_AVATAR; }, { once: true });
  const details = document.createElement("span");
  details.textContent = creator.displayName || game.creatorName || "Games Lab player";
  const subtitle = document.createElement("small");
  subtitle.textContent = "Community creator";
  details.append(subtitle);
  wrapper.append(avatar, details);
  return wrapper;
}

function createModerationControls(game) {
  const controls = document.createElement("form");
  controls.className = "moderation";
  const label = document.createElement("label");
  label.textContent = "Moderator removal message";
  const note = document.createElement("textarea");
  note.maxLength = 500;
  note.required = true;
  note.placeholder = "Explain why this game was removed. Its creator will see this note.";
  const actions = document.createElement("div");
  actions.className = "card-actions";
  const remove = document.createElement("button");
  remove.className = "button secondary";
  remove.type = "submit";
  remove.textContent = "Take down game";
  const feedback = document.createElement("p");
  feedback.className = "moderation-message";
  feedback.setAttribute("role", "status");
  actions.append(remove);
  label.append(note);
  controls.append(label, actions, feedback);
  controls.addEventListener("submit", async (event) => {
    event.preventDefault();
    const removalMessage = note.value.trim();
    if (!removalMessage) {
      feedback.textContent = "Write a message for the creator before taking the game down.";
      return;
    }
    if (!window.confirm(`Take down "${game.title}" and send this message to its creator?`)) return;
    remove.disabled = true;
    try {
      await updateDoc(doc(communityGames, game.id), {
        status: "removed",
        removalMessage,
        removedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      feedback.textContent = friendlyError(error, "Could not remove a community game.");
      remove.disabled = false;
    }
  });
  return controls;
}

function openGame(game) {
  const title = document.getElementById("dialog-title");
  title.textContent = game.title;
  gameFrame.title = `${game.title} community game`;
  gameFrame.setAttribute("sandbox", "allow-scripts");
  gameFrame.referrerPolicy = "no-referrer";
  if (game.mode === "html") {
    gameFrame.srcdoc = gameDocumentHTML(game.content);
    openGameLink.hidden = true;
    openGameLink.removeAttribute("href");
  } else {
    const url = new URL(game.content);
    if (url.protocol !== "https:") {
      setMessage("browse-message", "This game has an invalid website address.", "error");
      return;
    }
    gameFrame.src = url.href;
    openGameLink.href = url.href;
    openGameLink.hidden = false;
  }
  gameDialog.showModal();
}

function createGameCard(game, creator) {
  const card = document.createElement("article");
  card.className = "community-card glass";
  const art = document.createElement("div");
  art.className = "community-card-art";
  art.setAttribute("aria-hidden", "true");
  art.textContent = game.mode === "url" ? "🌐" : "🎮";

  const body = document.createElement("div");
  body.className = "community-card-body";
  body.append(createCreator(game, creator));
  const title = document.createElement("h3");
  title.textContent = game.title;
  const description = document.createElement("p");
  description.className = "community-description";
  description.textContent = game.description || "A game shared with the Games Lab community.";
  body.append(title, description);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const play = document.createElement("button");
  play.type = "button";
  play.className = "button";
  play.textContent = "Play game ↗";
  play.addEventListener("click", () => openGame(game));
  actions.append(play);
  if (game.mode === "url") {
    const open = document.createElement("a");
    open.className = "button secondary";
    open.href = game.content;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open website";
    actions.append(open);
  }
  body.append(actions);
  if (isAdmin) body.append(createModerationControls(game));
  card.append(art, body);
  return card;
}

async function renderPublicGames() {
  const generation = ++publicGeneration;
  const search = gameSearch.value.trim().toLowerCase();
  const visible = publicGames.filter((game) =>
    `${game.title} ${game.description} ${game.creatorName}`.toLowerCase().includes(search));
  document.getElementById("community-count").textContent =
    `${visible.length} ${visible.length === 1 ? "game" : "games"}`;
  document.getElementById("community-empty").hidden = visible.length > 0;
  gameGrid.replaceChildren();
  try {
    const creators = await Promise.all(visible.map((game) => getCreatorProfile(game)));
    if (generation !== publicGeneration) return;
    gameGrid.replaceChildren(...visible.map((game, index) => createGameCard(game, creators[index])));
  } catch (error) {
    setMessage("browse-message", friendlyError(error, "Could not show community games."), "error");
  }
}

function renderOwnGames() {
  const list = document.getElementById("owner-games");
  const sorted = [...ownGames].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  list.replaceChildren();
  for (const game of sorted) {
    const card = document.createElement("article");
    card.className = "owner-game glass";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = game.title;
    const state = document.createElement("p");
    state.textContent = game.status === "removed" ? "Removed by a moderator" : "Published";
    details.append(title, state);
    if (game.status === "removed" && game.removalMessage) {
      const notice = document.createElement("p");
      notice.className = "moderation-notice";
      notice.textContent = `Moderator message: ${game.removalMessage}`;
      details.append(notice);
    }
    card.append(details);
    if (game.status === "published") {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "button secondary";
      play.textContent = "Play";
      play.addEventListener("click", () => openGame(game));
      card.append(play);
    }
    list.append(card);
  }
}

function subscribeToGames(user) {
  stopPublicGames();
  stopOwnGames();
  const publicQuery = query(communityGames, where("status", "==", "published"));
  stopPublicGames = onSnapshot(publicQuery, (snapshot) => {
    publicGames = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    publicGames.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    renderPublicGames();
    setMessage("browse-message", "");
  }, (error) => {
    setMessage("browse-message", friendlyError(error, "Could not load the community game list."), "error");
  });

  const ownQuery = query(communityGames, where("ownerUid", "==", user.uid));
  stopOwnGames = onSnapshot(ownQuery, (snapshot) => {
    ownGames = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderOwnGames();
    setMessage("owner-message", ownGames.length ? "" : "Your shared games and any moderator notes will appear here.");
  }, (error) => {
    setMessage("owner-message", friendlyError(error, "Could not load your community submissions."), "error");
  });

  if (isAdmin) {
    getDocs(communityGames).then((snapshot) => {
      publicGames = snapshot.docs
        .filter((item) => item.data().status === "published")
        .map((item) => ({ id: item.id, ...item.data() }));
      publicGames.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderPublicGames();
    }).catch((error) => {
      setMessage("browse-message", friendlyError(error, "Could not load community moderation tools."), "error");
    });
  }
}

sourceRadios.forEach((radio) => radio.addEventListener("change", sourceModeChanged));
sourceModeChanged();
gameSearch.addEventListener("input", renderPublicGames);
submitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeUser) {
    setMessage("submit-message", "Sign in before publishing a community game.", "error");
    return;
  }
  const title = document.getElementById("game-title").value.trim();
  const description = document.getElementById("game-description").value.trim();
  const mode = submitForm.elements["source-kind"].value;
  let content = "";
  if (mode === "html") {
    content = document.getElementById("game-html").value.trim();
    if (!content) {
      setMessage("submit-message", "Paste the HTML for your game before publishing it.", "error");
      return;
    }
    if (content.length > MAX_HTML_LENGTH) {
      setMessage("submit-message", `Game HTML must be ${MAX_HTML_LENGTH.toLocaleString()} characters or less.`, "error");
      return;
    }
  } else {
    try {
      const url = new URL(document.getElementById("game-url").value.trim());
      if (url.protocol !== "https:") throw new Error("Only HTTPS website links can be shared.");
      content = url.href;
    } catch (error) {
      setMessage("submit-message", error.message || "Enter a valid HTTPS website link.", "error");
      return;
    }
  }
  const submitButton = document.getElementById("submit-game");
  const signature = JSON.stringify([activeUser.uid, title, description, mode, content]);
  if (!pendingSubmission || pendingSubmission.signature !== signature) {
    pendingSubmission = { signature, reference: doc(communityGames) };
  }
  const submission = pendingSubmission;
  submitButton.disabled = true;
  submitButton.textContent = "Publishing...";
  setMessage("submit-message", "");
  try {
    profile = await saveCommunityProfile(activeUser);
    if (!submission.operation) {
      submission.operation = setDoc(submission.reference, {
        title,
        description,
        mode,
        content,
        ownerUid: activeUser.uid,
        creatorName: profile.displayName,
        creatorPhoto: profile.photoUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "published",
        removalMessage: "",
        removedAt: null
      });
      submission.operation.catch((error) => {
        if (pendingSubmission === submission) submission.operation = null;
        if (submission.timedOut) {
          setMessage("submit-message", friendlyError(error, "Could not publish a community game."), "error");
        }
      });
    }
    await waitForFirestore(submission.operation, "Publishing is taking longer than expected. The game may still finish saving; retrying this same form is safe.");
    pendingSubmission = null;
    submitForm.reset();
    sourceModeChanged();
    setMessage("submit-message", "Your game is published in the community arcade!", "success");
  } catch (error) {
    if (error.code === "timeout" && submission.operation) submission.timedOut = true;
    setMessage("submit-message", friendlyError(error, "Could not publish a community game."), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publish community game";
  }
});

document.getElementById("close-game").addEventListener("click", () => gameDialog.close());
gameDialog.addEventListener("close", () => {
  gameFrame.removeAttribute("src");
  gameFrame.srcdoc = "";
  openGameLink.hidden = true;
  openGameLink.removeAttribute("href");
});
gameDialog.addEventListener("click", (event) => {
  if (event.target === gameDialog) gameDialog.close();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }
  activeUser = user;
  isAdmin = user.uid === ADMIN_UID;
  document.getElementById("my-games-heading").textContent = isAdmin ? "Community moderation" : "My submissions";
  try {
    profile = await saveCommunityProfile(user);
    subscribeToGames(user);
  } catch (error) {
    setMessage("browse-message", friendlyError(error, "Could not connect community games."), "error");
    setMessage("owner-message", "Check that Firestore is enabled and firestore.rules has been published.");
    subscribeToGames(user);
  }
});
