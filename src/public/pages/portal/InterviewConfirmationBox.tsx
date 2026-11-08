import { useEffect, useMemo, useState } from 'react';
import { Check, Hourglass, X } from 'lucide-react';
import { ArchonAlert, confirmDialog, promptText } from '../../../utils/alerts';
import { phpFjY, phpMjYgiA } from '../../../utils/format';
import type { PortalInterviewConfirmation } from '../../../types/portal';

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };

export const EXPIRED_MESSAGE = 'Your interview confirmation period has expired. Please contact the recruitment team.';

/**
 * Time left until the deadline. It starts from the seconds the server computed
 * from the stored deadline (not the browser clock) and only counts down between
 * server refreshes; the server refuses any answer after the deadline anyway.
 */
export function useTimeLeft(secondsLeft: number, deadline: string): number {
    const endAt = useMemo(() => Date.now() + secondsLeft * 1000, [secondsLeft, deadline]); // eslint-disable-line react-hooks/exhaustive-deps
    const [left, setLeft] = useState(() => Math.max(0, endAt - Date.now()));
    useEffect(() => {
        const tick = () => setLeft(Math.max(0, endAt - Date.now()));
        tick();
        const id = window.setInterval(tick, 15_000);
        return () => window.clearInterval(id);
    }, [endAt]);
    return left;
}

/** "2 days 14 hours 32 minutes" */
export function formatLeft(ms: number): string {
    // Rounded down, so the time shown never exceeds what is really left.
    const totalMinutes = Math.floor(ms / 60_000);
    if (totalMinutes < 1) return 'less than a minute';
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    return [d ? part(d, 'day') : '', h ? part(h, 'hour') : '', m ? part(m, 'minute') : ''].filter(Boolean).join(' ');
}

type Answer = (choice: 'confirm' | 'decline', reason: string) => Promise<{ success: boolean; message?: string; expired?: boolean }>;

/**
 * "Will you attend this interview?" with Confirm Attendance / Decline Attendance,
 * the confirmation deadline and the time left. After an answer (or once the
 * deadline has passed) it shows the result instead.
 */
export default function InterviewConfirmationBox({ c, onAnswer, onDone }: { c: PortalInterviewConfirmation; onAnswer: Answer; onDone: () => unknown }) {
    const left = useTimeLeft(c.seconds_left, c.deadline);
    const [busy, setBusy] = useState(false);
    const expired = c.status === 'Expired' || (c.status === 'Pending Confirmation' && left <= 0);

    const send = async (choice: 'confirm' | 'decline', reason = '') => {
        setBusy(true);
        try {
            const r = await onAnswer(choice, reason);
            if (r.success) await ArchonAlert.success(r.message || 'Your answer was saved.');
            else if (r.expired) await ArchonAlert.warning(EXPIRED_MESSAGE, { title: 'Confirmation Period Expired' });
            else await ArchonAlert.error(r.message || 'Your answer could not be saved.');
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'Your answer could not be saved.');
        } finally {
            setBusy(false);
            await onDone();
        }
    };
    const confirm = async () => {
        if (expired) { await ArchonAlert.warning(EXPIRED_MESSAGE, { title: 'Confirmation Period Expired' }); return; }
        const ok = await confirmDialog({ title: 'Confirm Attendance', paragraphs: ['Are you sure you want to confirm your attendance?'], icon: 'question', confirmText: 'Confirm Attendance' });
        if (ok) await send('confirm');
    };
    const decline = async () => {
        if (expired) { await ArchonAlert.warning(EXPIRED_MESSAGE, { title: 'Confirmation Period Expired' }); return; }
        const reason = await promptText({
            title: 'Decline Attendance', icon: 'warning', danger: true, confirmText: 'Decline Interview',
            html: '<p>Are you sure you want to decline this interview?</p><p>Your application is not rejected because of this: our recruitment team will contact you about the next step.</p>',
            label: 'Reason for declining', placeholder: 'e.g., I have a prior commitment on that date. Could the interview be moved?',
            validate: v => {
                const t = v.replace(/\s+/g, ' ').trim();
                if (t.length < 5) return 'Please tell us why you cannot attend (at least 5 characters).';
                return /[<>]/.test(t) ? 'Please do not use < or > characters.' : '';
            },
        });
        if (reason !== null) await send('decline', reason);
    };

    if (c.status === 'Confirmed') {
        return <div className="portal-confirmation confirmed" data-status="Confirmed"><Check /> <strong>Attendance confirmed</strong>{c.responded_at ? ` on ${phpMjYgiA(c.responded_at)}` : ''}.</div>;
    }
    if (c.status === 'Declined') {
        return (
            <div className="portal-confirmation declined" data-status="Declined">
                <X /> <strong>You declined this interview</strong>{c.responded_at ? ` on ${phpMjYgiA(c.responded_at)}` : ''}. Our recruitment team will contact you about the next step.
                {c.response_reason && <div className="portal-muted">Your reason: {c.response_reason}</div>}
            </div>
        );
    }
    if (expired) {
        return <div className="portal-confirmation expired" data-status="Expired"><Hourglass /> <strong>Confirmation period expired.</strong> {EXPIRED_MESSAGE.replace('Your interview confirmation period has expired. ', '')}</div>;
    }
    return (
        <div className="portal-confirmation pending" data-status="Pending Confirmation">
            <div><strong>Confirmation Required</strong></div>
            <p className="portal-muted" style={{ margin: '4px 0' }}>
                Will you attend this interview? Please confirm your attendance within <strong className="ic-time-left">{formatLeft(left)}</strong>
                {' '}(deadline: {phpFjY(c.deadline)} {phpMjYgiA(c.deadline).split(' ').slice(-2).join(' ')}).
            </p>
            <div className="portal-toolbar-actions" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-primary btn-ic-confirm" disabled={busy || !c.can_respond} onClick={() => void confirm()}><Check /> Confirm Attendance</button>
                <button type="button" className="btn btn-outline btn-ic-decline" style={outlineBtn} disabled={busy || !c.can_respond} onClick={() => void decline()}><X /> Decline Attendance</button>
            </div>
        </div>
    );
}
