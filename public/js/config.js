// ============================================================
// 填入你的 Firebase 项目配置
// Firebase Console → 项目设置 → 你的应用 → firebaseConfig
// ============================================================
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 管理员 Google 邮箱（首次登录的人自动成为管理员，此处仅作备注）
// 如需指定固定管理员，填入邮箱；否则留空（首位登录者自动成为管理员）
export const SUPER_ADMIN_EMAIL = "";
