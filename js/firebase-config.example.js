// Copy this file to firebase-config.js and fill in your Firebase web app config.
// Restrict the API key in Google Cloud and secure access with Firebase rules.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

// Set this to the public app URL when generating QR codes; leave empty to use
// the current browser URL.
const APP_BASE_URL = "";

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
storage.setMaxUploadRetryTime(2000);
