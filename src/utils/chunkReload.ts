/**
 * Recovery for "Failed to fetch dynamically imported module".
 *
 * Each build replaces the page chunks (DashboardPage-<hash>.js ...). A tab
 * that was opened before a rebuild still runs the old code and asks for chunk
 * names that no longer exist. Reloading once loads the current build; the
 * guard makes sure a genuinely missing file can never cause a reload loop.
 */

const KEY = 'archon_chunk_reload_at';
const WINDOW_MS = 30000;

/** True for the errors browsers raise when a dynamic import / module script cannot be loaded. */
export function isChunkLoadError(error: unknown): boolean {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(message);
}

/** Reload the page to pick up the current build, at most once per 30 s. Returns false if it already tried. */
export function reloadForNewBuild(): boolean {
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* storage unavailable */ }
    if (Date.now() - last < WINDOW_MS) return false;
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
    window.location.reload();
    return true;
}

/**
 * Vite reports failed chunk preloads with this event; recover the same way.
 * The event is deliberately not cancelled: cancelling makes the import resolve
 * to nothing, so the page would fail with a misleading error instead of the
 * real "failed to fetch" one that RouteError recognises.
 */
export function installChunkReloadHandler(): void {
    window.addEventListener('vite:preloadError', () => {
        reloadForNewBuild();
    });
}
