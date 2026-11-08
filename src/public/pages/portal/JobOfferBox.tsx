import { useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { ArchonAlert, confirmDialog, promptText } from '../../../utils/alerts';
import { phpFjY, phpMjYgiA } from '../../../utils/format';
import type { PortalJobOffer } from '../../../types/portal';

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };
const BADGE: Record<PortalJobOffer['status'], string> = {
    Extended: 'status-interview', Accepted: 'status-hired', Declined: 'status-rejected', Expired: 'status-submitted', Withdrawn: 'status-submitted',
};
const peso = (n: number) => `PHP ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a month`;

function Item({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
    return (
        <div className={full ? 'review-item full' : 'review-item'}>
            <label>{label}</label>
            <div className="review-value">{children}</div>
        </div>
    );
}

type Answer = (choice: 'accept' | 'decline', reason: string) => Promise<{ success: boolean; message?: string }>;

/**
 * The applicant's job offer with Accept Offer / Decline Offer (until the
 * expiration date; the server refuses a late or second answer). After accepting,
 * HR confirms the hire.
 */
export default function JobOfferBox({ offer, onAnswer, onDone }: { offer: PortalJobOffer; onAnswer: Answer; onDone: () => unknown }) {
    const [busy, setBusy] = useState(false);
    const send = async (choice: 'accept' | 'decline', reason = '') => {
        setBusy(true);
        try {
            const r = await onAnswer(choice, reason);
            if (r.success) await ArchonAlert.success(r.message || 'Your answer was saved.');
            else await ArchonAlert.error(r.message || 'Your answer could not be saved.');
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'Your answer could not be saved.');
        } finally {
            setBusy(false);
            await onDone();
        }
    };
    const accept = async () => {
        const ok = await confirmDialog({
            title: 'Accept Job Offer',
            paragraphs: [`Are you sure you want to accept job offer ${offer.offer_no} for ${offer.position}? Our HR team will then confirm your hiring and contact you about onboarding.`],
            details: [{ label: 'Start Date', value: phpFjY(offer.start_date) }, { label: 'Monthly Salary', value: peso(offer.salary) }],
            icon: 'question', confirmText: 'Accept Offer',
        });
        if (ok) await send('accept');
    };
    const decline = async () => {
        const reason = await promptText({
            title: 'Decline Job Offer', icon: 'warning', danger: true, confirmText: 'Decline Offer',
            html: `<p>Are you sure you want to decline this job offer? This cannot be undone.</p>`,
            label: 'Reason for declining', placeholder: 'e.g., I accepted another offer.',
            validate: v => {
                const t = v.replace(/\s+/g, ' ').trim();
                if (t.length < 5) return 'Please tell us why you are declining (at least 5 characters).';
                return /[<>]/.test(t) ? 'Please do not use < or > characters.' : '';
            },
        });
        if (reason !== null) await send('decline', reason);
    };

    return (
        <div className="portal-interview portal-offer" data-status={offer.status}>
            <h4 className="portal-interview-title">
                Job Offer {offer.offer_no} <span className={`status-badge ${BADGE[offer.status]}`}>{offer.status_label}</span>
            </h4>
            <div className="review-grid-2">
                <Item label="Position">{offer.position}</Item>
                <Item label="Department">{offer.department}</Item>
                <Item label="Employment Type">{offer.employment_type}</Item>
                <Item label="Monthly Salary">{peso(offer.salary)}</Item>
                <Item label="Start Date">{phpFjY(offer.start_date)}</Item>
                <Item label="Work Schedule">{offer.work_schedule || 'To be advised by HR'}</Item>
                {offer.benefits && <Item label="Benefits" full><span style={{ whiteSpace: 'pre-line' }}>{offer.benefits}</span></Item>}
                {offer.terms && <Item label="Additional Terms" full><span style={{ whiteSpace: 'pre-line' }}>{offer.terms}</span></Item>}
                <Item label="Answer By">{phpFjY(offer.expires_on)}</Item>
                {offer.responded_at && <Item label="Your Answer">{offer.applicant_response} · {phpMjYgiA(offer.responded_at)}</Item>}
            </div>
            {offer.can_respond ? (
                <div className="portal-confirmation pending">
                    <strong>Please accept or decline this offer by {phpFjY(offer.expires_on)}.</strong>
                    <div className="portal-toolbar-actions" style={{ marginTop: 10 }}>
                        <button type="button" className="btn btn-primary btn-offer-accept" disabled={busy} onClick={() => void accept()}><Check /> Accept Offer</button>
                        <button type="button" className="btn btn-outline btn-offer-decline" style={outlineBtn} disabled={busy} onClick={() => void decline()}><X /> Decline Offer</button>
                    </div>
                </div>
            ) : offer.closed_message && (
                <div className={`portal-confirmation ${offer.applicant_response === 'Accepted' || offer.status === 'Accepted' ? 'confirmed' : offer.status === 'Declined' ? 'declined' : 'expired'}`}>
                    {offer.closed_message}
                </div>
            )}
        </div>
    );
}
