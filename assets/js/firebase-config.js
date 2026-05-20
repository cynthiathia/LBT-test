/**
 * Firebase 프로젝트 설정
 *
 * Realtime Database 규칙 (Firebase 콘솔에서 설정):
 *   { "rules": { ".read": "auth != null", ".write": "auth != null" } }
 *
 * 모든 페이지에서 자동으로 익명 로그인하여, 외부 봇/스크립트의 직접 접근을 차단.
 * DB 호출 전에는 반드시 `await authReady` 로 인증 완료를 기다려야 합니다.
 */
const firebaseConfig = {
  apiKey:            "AIzaSyAmdqC2jWa6bs12ggUSXTdmllhaRSVzw9A",
  authDomain:        "language-type-test.firebaseapp.com",
  databaseURL:       "https://language-type-test-default-rtdb.firebaseio.com",
  projectId:         "language-type-test",
  storageBucket:     "language-type-test.firebasestorage.app",
  messagingSenderId: "413102289468",
  appId:             "1:413102289468:web:aa9deb42b14b0844fb4939",
  measurementId:     "G-3YCP0M9W54",
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.database();
const auth = firebase.auth();

/**
 * 익명 자동 로그인. 같은 브라우저는 같은 익명 UID를 유지함.
 * 완료 전까지 DB 작업은 기다려야 함.
 */
const authReady = new Promise((resolve) => {
  let resolved = false;
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (!resolved) { resolved = true; resolve(user); }
      return;
    }
    auth.signInAnonymously().catch((err) => {
      console.error('[LBT] 익명 로그인 실패:', err && err.message || err);
      // 실패해도 페이지가 멈추지 않도록 resolve (DB 호출은 실패할 것)
      if (!resolved) { resolved = true; resolve(null); }
    });
    // 성공 시 onAuthStateChanged가 user 있는 상태로 다시 호출되어 resolve
  });
});
