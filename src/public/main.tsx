import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PublicApp from './PublicApp';
import { installChunkReloadHandler } from '../utils/chunkReload';

// The public site's own stylesheets (single source of truth, shared with nothing
// else) - kept out of the HRMS bundle because both define .header, .card, .btn...
import '../assets/Homepage/css/style.css';
import '../assets/Homepage/css/applicant.css';
import '../assets/Homepage/css/responsive.css';
// SweetAlert2 theme used by the site's toasts and alerts.
import '../styles/archon-alerts.css';

installChunkReloadHandler();

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <PublicApp />
    </StrictMode>,
);
