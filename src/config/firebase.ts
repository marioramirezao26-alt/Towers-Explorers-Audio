import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, Auth } from 'firebase/auth';
// @ts-ignore - Metro resuelve esto a la build react-native del SDK en tiempo de compilación,
// aunque el tipado "node"/"browser" que ve `tsc` por fuera de Expo no lo declara.
import { getReactNativePersistence } from 'firebase/auth';
// @ts-ignore - no type declarations for this subpath, but it exists at runtime
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws if called twice (e.g. Fast Refresh) — fall back to the existing instance.
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, storage, functions };
