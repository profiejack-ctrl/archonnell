import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Calendar, ClipboardList, Megaphone } from 'lucide-react';
import Icon from '../components/Icon';
import { announcementService } from '../services/announcementService';
import { useAuth } from '../hooks/AuthContext';
import { useAnnouncementViewer } from './AnnouncementViewer';
import { fmtLongDate } from '../utils/format';
import type { NotificationItem, WorkflowNotification } from '../types';

/** Fired every minute so an open dashboard refreshes its announcement list too. */
export const ANNOUNCEMENTS_REFRESH_EVENT = 'archon:announcements-refresh';

/** Module label of a workflow notification, from the page it opens. */
function workflowLabel(link: string | null): string {
    if (link === '/leave-management' || link === '/my-leave') return 'Leave';
    if (link === '/attendance-schedule' || link === '/my-attendance' || link === '/shift-schedule' || link === '/time-attendance') return 'Schedule';
    if (link === '/employee-directory' || link === '/employee-self-service') return 'Employee Information';
    return 'Recruitment';
}

/**
 * Header notification bell: announcements plus workflow notifications
 * (vacancy requests, job postings, schedules, leave), one unread badge, list and read state.
 */
export default function NotificationBell() {
    const { session, setUnreadCount } = useAuth();
    const openAnnouncement = useAnnouncementViewer();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[] | null>(null);
    const [workflow, setWorkflow] = useState<WorkflowNotification[]>([]);
    const navigate = useNavigate();
    const wrapRef = useRef<HTMLDivElement>(null);
    const unread = session?.unread_count ?? 0;

    const refresh = useCallback(async () => {
        try {
            const res = await announcementService.notifications();
            setUnreadCount(res.unread_count);
            setItems(res.data || []);
            setWorkflow(res.workflow || []);
        } catch (err) {
            console.warn('notifications:', err instanceof Error ? err.message : err);
        }
    }, [setUnreadCount]);

    // First paint: the list the server knows about right now.
    useEffect(() => { void refresh(); }, [refresh]);

    // Keep the badge + dashboard list current while the tab is open (not user activity).
    useEffect(() => {
        const t = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            announcementService.notifications(true).then(r => setUnreadCount(r.unread_count)).catch(() => undefined);
            window.dispatchEvent(new Event(ANNOUNCEMENTS_REFRESH_EVENT));
        }, 60000);
        return () => window.clearInterval(t);
    }, [setUnreadCount]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('click', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen) void refresh();
    };

    const onItem = async (n: NotificationItem) => {
        setItems(list => (list || []).map(x => (x.id === n.id ? { ...x, is_read: true } : x)));
        try {
            const res = await announcementService.markRead(n.id);
            setUnreadCount(res.unread_count);
        } catch (err) {
            console.warn('notification_read:', err instanceof Error ? err.message : err);
        }
        setOpen(false);
        openAnnouncement(n.id);
    };

    /** A workflow notification: mark it read and open the page it is about. */
    const onWorkflow = async (n: WorkflowNotification) => {
        setWorkflow(list => list.map(x => (x.id === n.id ? { ...x, is_read: true } : x)));
        try {
            const res = await announcementService.markWorkflowRead(n.id);
            setUnreadCount(res.unread_count);
        } catch (err) {
            console.warn('workflow_notification_read:', err instanceof Error ? err.message : err);
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    // One list, newest first.
    const entries = [
        ...(items ?? []).map(n => ({ kind: 'ann' as const, at: n.published_at, n })),
        ...workflow.map(n => ({ kind: 'wf' as const, at: n.created_at, n })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

    const readAll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await announcementService.markAllRead();
            setUnreadCount(0);
            setItems(list => (list || []).map(x => ({ ...x, is_read: true })));
            setWorkflow(list => list.map(x => ({ ...x, is_read: true })));
        } catch (err) {
            console.warn('notifications_read_all:', err instanceof Error ? err.message : err);
        }
    };

    return (
        <div className="notification-wrap" id="notificationWrap" ref={wrapRef}>
            <button type="button" className="header-icon-btn notification-btn" id="notificationToggle" title="Notifications"
                aria-label="Notifications" aria-haspopup="true" aria-expanded={open} onClick={toggle}>
                <Icon as={Bell} />
                <span className="notification-count" id="notificationCount" hidden={unread <= 0}>{unread > 9 ? '9+' : unread}</span>
            </button>
            <div className="notification-popover" id="notificationPanel" hidden={!open} role="menu" aria-label="Notifications">
                <div className="notification-panel-head">
                    <h3><Icon as={Bell} /> Notifications</h3>
                    <button type="button" className="notification-readall" id="notificationReadAll" onClick={readAll}>Mark all read</button>
                </div>
                <div className="notification-list" id="notificationList">
                    {!entries.length ? (
                        <div className="notification-empty">
                            <Icon as={BellOff} />
                            <p className="notification-empty-title">No new notifications</p>
                            <p className="notification-empty-sub">You're all caught up.</p>
                        </div>
                    ) : entries.map(({ kind, n }) => kind === 'wf' ? (
                        <button type="button" key={`wf-${n.id}`} className={`notification-item${n.is_read ? '' : ' is-unread'}`} data-wf-id={n.id} onClick={() => void onWorkflow(n)}>
                            <span className="notification-item-icon" aria-hidden="true"><Icon as={ClipboardList} /></span>
                            <span className="notification-item-body">
                                <span className="notification-item-type">{workflowLabel(n.link)}</span>
                                <span className="notification-item-title">{n.title}</span>
                                <span className="notification-item-msg">{n.message}</span>
                                <span className="notification-item-date"><Icon as={Calendar} /> {fmtLongDate(n.created_at)}</span>
                            </span>
                            <span className="notification-item-unread" aria-hidden="true"></span>
                        </button>
                    ) : (
                        <button type="button" key={`ann-${n.id}`} className={`notification-item${n.is_read ? '' : ' is-unread'}`} data-ann-id={n.id} onClick={() => void onItem(n)}>
                            <span className="notification-item-icon" aria-hidden="true"><Icon as={Megaphone} /></span>
                            <span className="notification-item-body">
                                <span className="notification-item-type">New Announcement</span>
                                <span className="notification-item-title">{n.title}</span>
                                <span className="notification-item-msg">A new company announcement has been published.</span>
                                <span className="notification-item-date"><Icon as={Calendar} /> {fmtLongDate(n.published_at)}</span>
                            </span>
                            <span className="notification-item-unread" aria-hidden="true"></span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
