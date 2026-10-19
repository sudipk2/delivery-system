// Firebase project configuration.
// Copy these values from Firebase Console > Project settings > Your apps > Web app.
// This browser config is not a password; Firestore Security Rules protect your data.
export const firebaseConfig = {
  apiKey: "AIzaSyAK2xlGplPoP73BI7s2yJ8VeJ2MDHxlHLA",
  authDomain: "online-delivery-platform-2e03b.firebaseapp.com",
  projectId: "online-delivery-platform-2e03b",
  storageBucket: "online-delivery-platform-2e03b.firebasestorage.app",
  messagingSenderId: "421455912393",
  appId: "1:421455912393:web:3a9c10fd0014144cc2dc18",
  measurementId: "G-BM1SHNTDKP"
};

// Use the exact email of the verified administrator account you create.
// Keep the same email in firestore.rules. This is an allowlist, not a password.
export const adminEmailAllowlist = [
  "kandelsudip321@gmail.com"
];
