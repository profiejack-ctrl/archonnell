import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installChunkReloadHandler } from './utils/chunkReload';

// Icon adapter first, so the system stylesheets win wherever they style icons.
import './styles/icons.css';
// The system's own stylesheets, shared with the PHP pages (single source of truth).
import '../../styles.css';
import '../../css/system-responsive.css';
import '../../css/archon-alerts.css';
import './styles/app.css';

// Legacy deep links used index.php#<page>; the router expects #/<page>.
const hash = window.location.hash;
if (hash && !hash.startsWith('#/')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${hash.slice(1)}`);
}

// A tab opened before a rebuild reloads once to pick up the current build's chunks.
installChunkReloadHandler();

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
