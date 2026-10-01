import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase の初期化
const app = initializeApp(firebaseConfig);

// Realtime Database インスタンスのエクスポート
export const db = getDatabase(app);
// Wait for a live connection before starting writes, which Firebase otherwise queues offline.
export function waitForFirebaseConnection(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Firebaseに接続できません。.env.localのVITE_FIREBASE_DATABASE_URLをFirebaseコンソールのRealtime DatabaseのURLと照合し、開発サーバーを再起動してください。')), timeoutMs);
    try {
      unsubscribe = onValue(ref(db, '.info/connected'), snapshot => {
        if (snapshot.val() === true) finish();
      }, error => finish(error));
      if (settled) unsubscribe();
    } catch (cause) {
      finish(cause instanceof Error ? cause : new Error('Firebase接続の初期化に失敗しました。'));
    }
  });
}
