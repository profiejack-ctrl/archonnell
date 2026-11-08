import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle, LayoutDashboard, RotateCw } from 'lucide-react';
import { isChunkLoadError, reloadForNewBuild } from '../utils/chunkReload';

/**
 * Route error screen (replaces React Router's "Unexpected Application Error!").
 *
 *  - A page chunk from an older build could not be loaded: reload once to get
 *    the current build (see utils/chunkReload.ts).
 *  - Anything else: a plain explanation with Retry / Go to Dashboard. The
 *    technical detail goes to the browser console only.
 */
export default function RouteError() {
    const error = useRouteError();
    const chunk = isChunkLoadError(error);

    useEffect(() => {
        console.error('Route error:', error);
        if (chunk) reloadForNewBuild();
    }, [error, chunk]);

    const title = chunk ? 'The system was updated' : 'Something went wrong';
    const text = chunk
        ? 'This page could not be loaded because a newer version of the system is available. Reload the page to continue.'
        : isRouteErrorResponse(error) && error.status === 404
            ? 'The page you are looking for does not exist.'
            : 'This page could not be displayed. Please try again. If the problem continues, contact the system administrator.';

    const button = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid #d1d5db' } as const;

    return (
        <div role="alert" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, Arial, sans-serif' }}>
            <div style={{ maxWidth: 460, textAlign: 'center' }}>
                <AlertTriangle size={44} color="#f59e0b" aria-hidden="true" />
                <h1 style={{ fontSize: 22, margin: '12px 0 8px', color: '#111827' }}>{title}</h1>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4b5563', margin: '0 0 20px' }}>{text}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" style={{ ...button, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} onClick={() => window.location.reload()}>
                        <RotateCw size={16} aria-hidden="true" /> {chunk ? 'Reload' : 'Retry'}
                    </button>
                    <a href="#/" style={{ ...button, background: '#fff', color: '#111827', textDecoration: 'none' }} onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>
                        <LayoutDashboard size={16} aria-hidden="true" /> Go to Home
                    </a>
                </div>
            </div>
        </div>
    );
}
