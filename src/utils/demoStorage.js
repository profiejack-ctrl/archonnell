// Data in this prototype stays in this browser, not on a remote server.
// Invalid or old browser storage should not prevent the app from loading.
const prefix = 'archon_frontend_demo_v2_';
export function loadDemoData(key, fallback) {
  try {
    const stored = localStorage.getItem(prefix + key);
    if (stored === null) return fallback;
    const parsed = JSON.parse(stored);
    if (key === 'user' && (!parsed || !['admin', 'customer'].includes(parsed.role) || !String(parsed.id).startsWith('demo-'))) return null;
    if (['orders', 'products', 'cart'].includes(key) && !Array.isArray(parsed)) return fallback;
    if (key === 'reviews' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}
export function saveDemoData(key, data) {
  try {
    if (data == null) localStorage.removeItem(prefix + key);
    else localStorage.setItem(prefix + key, JSON.stringify(data));
    return true;
  } catch (error) {
    // Browser may have storage disabled or images may hit the quota.
    console.warn('Demo data could not be saved locally:', key, error?.name);
    return false;
  }
}
