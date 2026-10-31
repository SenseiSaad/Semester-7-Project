/* auth.js — frontend authentication: password check against the db, session
   persisted in localStorage, helpers for route guards.

   Honest limitation (also stated in the README): with no server, this guards
   the UI only. Passwords are demo-grade hashed and any user can read the
   localStorage payload. Fine for a course project / demo deploy. */

import { hashPassword } from './seed.js';
import { clearDriver } from './storage.js';

export const SESSION_KEY = 'saes_session_v3';

export function verifyUser(db, { email, password, role }) {
  const e = String(email || '').trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === e);
  if (!user) return { ok: false, error: 'No account with this email.' };
  if (role && user.role !== role) {
    return { ok: false, error: `This email is registered as a ${user.role}. Switch the role toggle and try again.` };
  }
  if (user.passwordHash !== hashPassword(password)) return { ok: false, error: 'Wrong password.' };
  return { ok: true, user: { id: user.id, name: user.name, role: user.role, email: user.email, rollNo: user.rollNo } };
}

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, ts: Date.now() }));
}
export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

/* Rehydrate the logged-in user after a page refresh. */
export function currentUser(db) {
  const s = getSession();
  if (!s) return null;
  const u = db.users.find((x) => x.id === s.id);
  if (!u) return null;
  return { id: u.id, name: u.name, role: u.role, email: u.email, rollNo: u.rollNo };
}

export function logout() { clearSession(); }

/* Danger-zone helper: wipe persisted data AND the session. */
export function resetEverything() { clearDriver(); clearSession(); }
