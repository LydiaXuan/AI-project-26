import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let db;

export function initDB(app) {
  db = getFirestore(app);
}

// ── Config / Settings ──────────────────────────────────────

export async function getSettings() {
  const snap = await getDoc(doc(db, 'config', 'settings'));
  return snap.exists() ? snap.data() : null;
}

export async function createSettings(data) {
  await setDoc(doc(db, 'config', 'settings'), data);
}

export async function updateSettings(data) {
  await updateDoc(doc(db, 'config', 'settings'), data);
}

// ── Users ──────────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setUser(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

// ── Projects ───────────────────────────────────────────────

export async function getProjects() {
  const snap = await getDocs(query(collection(db, 'projects'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addProject(name) {
  return await addDoc(collection(db, 'projects'), { name, createdAt: serverTimestamp() });
}

export async function deleteProject(id) {
  await deleteDoc(doc(db, 'projects', id));
}

// ── Testers (stored inside config/settings) ───────────────

export async function addTester(name) {
  const settings = await getSettings();
  const testers = settings?.testers || [];
  if (!testers.includes(name)) {
    await updateSettings({ testers: [...testers, name] });
  }
}

export async function removeTester(name) {
  const settings = await getSettings();
  const testers = (settings?.testers || []).filter(t => t !== name);
  await updateSettings({ testers });
}

// ── Tests ──────────────────────────────────────────────────

export async function createTest(data) {
  return await addDoc(collection(db, 'tests'), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function updateTest(id, data) {
  await updateDoc(doc(db, 'tests', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTest(id) {
  await deleteDoc(doc(db, 'tests', id));
}

export function subscribeTests(callback) {
  const q = query(collection(db, 'tests'), orderBy('startDate', 'desc'));
  return onSnapshot(q, snap => {
    const tests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(tests);
  });
}

export function subscribeProjects(callback) {
  const q = query(collection(db, 'projects'), orderBy('name'));
  return onSnapshot(q, snap => {
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(projects);
  });
}
