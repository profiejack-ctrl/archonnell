import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/**
 * Load a page's data (again whenever `deps` change), with a reload() the page
 * calls after a successful action (the legacy pages did a full
 * window.location.reload() instead).
 */
export function usePageData<T>(fetcher: () => Promise<T>, deps: DependencyList = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const alive = useRef(true);
    // Only the latest request may update the page (filters changed quickly: an older answer arriving last is dropped).
    const latest = useRef(0);

    const reload = useCallback(async () => {
        const id = ++latest.current;
        const current = () => alive.current && id === latest.current;
        try {
            const result = await fetcherRef.current();
            if (current()) { setData(result); setError(null); }
            return result;
        } catch (err) {
            if (current()) setError(err instanceof Error ? err.message : 'Request failed');
            return null;
        } finally {
            if (current()) setLoading(false);
        }
    }, []);

    useEffect(() => {
        alive.current = true;
        void reload();
        return () => { alive.current = false; };
    }, [reload, ...deps]);

    const retry = useCallback(() => { setLoading(true); setError(null); void reload(); }, [reload]);

    return { data, loading, error, reload, retry, setData };
}
