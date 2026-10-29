import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCT1nM-jF73LiO4zb1sv0mFCWMzjPThIxM",
  authDomain: "games-lab-a2298.firebaseapp.com",
  projectId: "games-lab-a2298",
  storageBucket: "games-lab-a2298.firebasestorage.app",
  messagingSenderId: "777350487864",
  appId: "1:777350487864:web:26406785b9e6e3d3852bcd",
  measurementId: "G-XDFTCZ1D9T"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
