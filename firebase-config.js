// firebase-config.js
// Live Firebase SDK Configuration for Project: convergence-5962c

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  setPersistence,
  inMemoryPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

/**
 * LIVE FIREBASE CONFIGURATION
 * Connected to Firebase Project: convergence-5962c
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAJ_aiY8KowaIMQIP4Og4eNZsieBfRuo30",
  authDomain: "convergence-5962c.firebaseapp.com",
  projectId: "convergence-5962c",
  storageBucket: "convergence-5962c.firebasestorage.app",
  messagingSenderId: "585585529405",
  appId: "1:585585529405:web:a9000e8016774447a11054",
  measurementId: "G-YRDLNS0YQ4"
};

export const isLiveFirebase = true;

let app = null;
let auth = null;
let db = null;
let storage = null;
let secondaryAuthInstance = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  // Ensure persistent session across page reloads
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn("Could not set local persistence:", err);
  });
  db = getFirestore(app);
  try {
    storage = getStorage(app);
  } catch (sErr) {
    console.warn("Firebase Storage init warning:", sErr);
  }
  console.log("Connected to Live Firebase Project:", firebaseConfig.projectId);
} catch (err) {
  console.error("Firebase live initialization error:", err);
}

/**
 * Secondary Firebase Auth instance factory for student provisioning.
 * Allows Admin to create new student Firebase Auth credentials
 * without replacing or logging out the Admin's active session.
 */
export async function getSecondaryAuth() {
  if (!secondaryAuthInstance) {
    const existing = getApps().find(a => a.name === "StudentProvisionerApp");
    const secApp = existing || initializeApp(firebaseConfig, "StudentProvisionerApp");
    secondaryAuthInstance = getAuth(secApp);
    await setPersistence(secondaryAuthInstance, inMemoryPersistence);
  }
  return secondaryAuthInstance;
}

export { 
  app, 
  auth, 
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
};
