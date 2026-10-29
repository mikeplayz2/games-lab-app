import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { makeAvatar, saveAvatar } from "./profile.js";

const form = document.getElementById("auth-form");
const nameInput = document.getElementById("display-name");
const avatarInput = document.getElementById("avatar-file");
const avatarPreview = document.getElementById("avatar-preview");
const message = document.getElementById("auth-message");
const submitButton = document.getElementById("submit-button");
const modeButton = document.getElementById("mode-button");
const modeDescription = document.getElementById("mode-description");
const nameField = document.getElementById("name-field");
const avatarField = document.getElementById("avatar-field");
let isSignup = false;
let selectedAvatar = "";

function showMessage(text, isError = true) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.toggle("success", !isError);
}

function firebaseError(error) {
  const messages = {
    "auth/email-already-in-use": "That email is already registered. Sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
    "auth/network-request-failed": "Network error. Check your connection and try again."
  };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  modeButton.disabled = isBusy;
  document.getElementById("google-button").disabled = isBusy;
  submitButton.textContent = isBusy
    ? "Please wait..."
    : isSignup ? "Create account" : "Sign in";
}

function showMode(signup) {
  isSignup = signup;
  nameField.hidden = !signup;
  avatarField.hidden = !signup;
  nameInput.required = signup;
  submitButton.textContent = signup ? "Create account" : "Sign in";
  modeButton.textContent = signup ? "Sign in" : "Create an account";
  modeDescription.textContent = signup
    ? "Already have an account?"
    : "New to Games Lab?";
  showMessage("");
}

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  selectedAvatar = "";
  if (!file) {
    avatarPreview.removeAttribute("src");
    avatarPreview.hidden = true;
    return;
  }
  try {
    selectedAvatar = await makeAvatar(file);
    avatarPreview.src = selectedAvatar;
    avatarPreview.hidden = false;
    showMessage("");
  } catch (error) {
    avatarInput.value = "";
    showMessage(error.message);
  }
});

modeButton.addEventListener("click", () => showMode(!isSignup));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  setBusy(true);

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (isSignup) {
      const displayName = nameInput.value.trim();
      if (!displayName) {
        throw new Error("Enter your name to create an account.");
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, {
        displayName
      });
      if (selectedAvatar) {
        saveAvatar(credential.user.uid, selectedAvatar);
      }
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    window.location.assign("./dashboard.html");
  } catch (error) {
    showMessage(firebaseError(error));
    setBusy(false);
  }
});

document.getElementById("google-button").addEventListener("click", async () => {
  showMessage("");
  setBusy(true);
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    window.location.assign("./dashboard.html");
  } catch (error) {
    showMessage(firebaseError(error));
    setBusy(false);
  }
});

showMode(false);
