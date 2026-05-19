/**
 * Firebase 프로젝트 설정
 *
 * Realtime Database 규칙 설정 필요:
 * Firebase 콘솔 → Realtime Database → 규칙 탭에서 아래로 변경
 * { "rules": { ".read": true, ".write": true } }
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
const db = firebase.database();
