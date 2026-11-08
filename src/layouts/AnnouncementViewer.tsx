import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Megaphone } from 'lucide-react';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { announcementService } from '../services/announcementService';
import { backendUrl } from '../services/http';
import { fmtLongDate } from '../utils/format';

interface ViewerState {
    title: string;
    summary: string;
    body: string;
    date: string;
    postedBy: string;
    cover: string | null;
}

const ViewerContext = createContext<(id: number) => void>(() => undefined);

/** "Employee: View Announcement" modal, opened from the dashboard list and the notification bell. */
export function AnnouncementViewerProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<ViewerState>({ title: '', summary: '', body: '', date: '', postedBy: '', cover: null });

    const show = useCallback(async (id: number) => {
        setState({ title: 'Loading…', summary: '', body: '', date: '', postedBy: '', cover: null });
        setOpen(true);
        try {
            const { data: a } = await announcementService.dashboardDetail(id);
            setState({
                title: a.title || 'Announcement',
                summary: a.summary || '',
                body: a.body || '',
                date: fmtLongDate(a.published_at),
                postedBy: a.created_by_name || 'Human Resources & Administration',
                cover: a.cover_image ? backendUrl(a.cover_image) : null,
            });
        } catch (err) {
            setState({
                title: 'Announcement unavailable',
                summary: '',
                body: err instanceof Error && err.message ? err.message : 'This announcement is no longer available to you.',
                date: '',
                postedBy: '',
                cover: null,
            });
        }
    }, []);

    const close = useCallback(() => setOpen(false), []);

    return (
        <ViewerContext.Provider value={show}>
            {children}
            <Modal open={open} onClose={close} titleTag="div" size="lg"
                title={<><Icon as={Megaphone} /> Announcement</>}
                footer={<button className="btn btn-outline" onClick={close}>Close</button>}>
                <div id="eaCoverWrap" hidden={!state.cover} style={{ marginBottom: '1rem' }}>
                    {state.cover && <img id="eaCover" alt="" src={state.cover} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />}
                </div>
                <h2 id="eaTitle" style={{ marginBottom: '0.35rem' }}>{state.title}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <span id="eaDate">{state.date}</span> &nbsp;&middot;&nbsp; Posted by <span id="eaPostedBy">{state.postedBy}</span>
                </div>
                <div id="eaSummary" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{state.summary}</div>
                <div id="eaBody" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{state.body}</div>
            </Modal>
        </ViewerContext.Provider>
    );
}

export function useAnnouncementViewer(): (id: number) => void {
    return useContext(ViewerContext);
}
