
// Standard Firebase v9+ modular imports
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBr5ZmAaZGOr_3SbrfyoCwhoKonx2DsLb0",
  authDomain: "siteigreja-461f6.firebaseapp.com",
  projectId: "siteigreja-461f6",
  // CHANGED: Fixed bucket domain to standard App Engine bucket to allow proper CORS headers
  storageBucket: "siteigreja-461f6.appspot.com", 
  messagingSenderId: "612518994868",
  appId: "1:612518994868:web:c0e25d7664ad1ca67f88e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
