// Firebase project configuration.
// Copy these values from Firebase Console > Project settings > Your apps > Web app.
// This browser config is not a password; Firestore Security Rules protect your data.
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_FIREBASE_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_FIREBASE_APP_ID"
};

// Use the exact email of the verified administrator account you create.
// Keep the same email in firestore.rules. This is an allowlist, not a password.
export const adminEmailAllowlist = [
  "admin@example.com"
];
