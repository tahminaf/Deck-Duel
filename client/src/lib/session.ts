const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setSession(token: string, username: string) {
  localStorage.setItem('accessToken', token);
  localStorage.setItem('username', username);
  localStorage.setItem('sessionExpiry', String(Date.now() + TTL));
}

export function isSessionValid(): boolean {
  const token = localStorage.getItem('accessToken');
  if (!token) return false;
  const expiry = localStorage.getItem('sessionExpiry');
  // No expiry stored = legacy session, keep it valid once but write the expiry now
  if (!expiry) {
    localStorage.setItem('sessionExpiry', String(Date.now() + TTL));
    return true;
  }
  return Date.now() < Number(expiry);
}

export function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('username');
  localStorage.removeItem('sessionExpiry');
}
