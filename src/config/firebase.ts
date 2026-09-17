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

/**
 * Si algo falla al inicializar Firebase, se guarda aquí en vez de lanzarse.
 *
 * Este archivo se ejecuta al importarse, antes de que React dibuje nada: una
 * excepción aquí cierra la app al instante y Android solo dice "Gaby se
 * detuvo", sin pista de la causa. Guardando el error, la app puede arrancar
 * igual y mostrarlo en pantalla (ver ErrorBoundary y App.tsx).
 */
export let firebaseInitError: Error | null = null;

let app: ReturnType<typeof initializeApp> | undefined;
let auth: Auth | undefined;
let db: ReturnType<typeof getFirestore> | undefined;
let storage: ReturnType<typeof getStorage> | undefined;
let functions: ReturnType<typeof getFunctions> | undefined;

try {
  const faltantes = Object.entries(firebaseConfig)
    .filter(([, valor]) => !valor)
    .map(([clave]) => clave);
  if (faltantes.length) {
    // Un mensaje concreto: con la configuración vacía, Firebase lanza
    // "auth/invalid-api-key", que no dice que lo que falta son las variables.
    throw new Error(
      `Falta la configuración de Firebase (${faltantes.join(', ')}). ` +
        'Se define al compilar, con las variables EXPO_PUBLIC_FIREBASE_*.',
    );
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if called twice (e.g. Fast Refresh) — fall back to the existing instance.
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
  }

  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);
} catch (error) {
  firebaseInitError = error instanceof Error ? error : new Error(String(error));
}

// Se exportan como no-opcionales a propósito: cuando la inicialización falla,
// App.tsx muestra el error y no monta nada que los toque, así que allí donde el
// resto de la app los usa, existen. Declararlos opcionales obligaría a
// comprobar por null en cada archivo para un caso que no llega a ocurrir.
const appOk = app as NonNullable<typeof app>;
const authOk = auth as NonNullable<typeof auth>;
const dbOk = db as NonNullable<typeof db>;
const storageOk = storage as NonNullable<typeof storage>;
const functionsOk = functions as NonNullable<typeof functions>;

export {
  appOk as app,
  authOk as auth,
  dbOk as db,
  storageOk as storage,
  functionsOk as functions,
};
