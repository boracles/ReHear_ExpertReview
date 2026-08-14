import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEFLs8q8jqmjo4P-hTHDNDD5UCNz8Hmdw",
  authDomain: "rehear-83639.firebaseapp.com",
  projectId: "rehear-83639",
  storageBucket: "rehear-83639.firebasestorage.app",
  messagingSenderId: "1057957343554",
  appId: "1:1057957343554:web:3ccab989afcae78b5fd8db",
  measurementId: "G-B3CJG2RMG6",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firestore = getFirestore(firebaseApp);
