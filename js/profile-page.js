import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { getAvatar, makeAvatar, saveAvatar } from "./profile.js";

const avatarPreview = document.getElementById("profile-preview");
const photoInput = document.getElementById("profile-photo");
const nameInput = document.getElementById("display-name");
const message = document.getElementById("profile-message");
const saveButton = document.getElementById("save-profile");
let activeUser = null;
let pendingAvatar = "";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }
  activeUser = user;
  nameInput.value = user.displayName || "";
  document.getElementById("email-address").value = user.email || "";
  avatarPreview.src = getAvatar(user.uid) || user.photoURL || "../assets/logo.png";
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  message.textContent = "";
  message.classList.remove("error");
  try {
    pendingAvatar = await makeAvatar(file);
    avatarPreview.src = pendingAvatar;
  } catch (error) {
    photoInput.value = "";
    message.textContent = error.message;
    message.classList.add("error");
  }
});

document.getElementById("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeUser) return;
  const displayName = nameInput.value.trim();
  if (!displayName) {
    message.textContent = "Enter a display name.";
    message.classList.add("error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  message.textContent = "";
  message.classList.remove("error");
  try {
    if (pendingAvatar) saveAvatar(activeUser.uid, pendingAvatar);
    await updateProfile(activeUser, { displayName });
    nameInput.value = displayName;
    pendingAvatar = "";
    message.textContent = "Your profile is up to date.";
  } catch (error) {
    message.textContent = error.message || "Your profile could not be saved. Please try again.";
    message.classList.add("error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
  }
});
