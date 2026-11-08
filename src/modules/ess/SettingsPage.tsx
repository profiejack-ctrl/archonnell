import { useState } from 'react';
import { Eye, EyeOff, Lock, Save } from 'lucide-react';
import Icon from '../../components/Icon';
import { Page, PageHeader } from '../../components/ui';
import { employeeService } from '../../services/employeeService';
import { ArchonAlert } from '../../utils/alerts';

type Field = 'current' | 'next' | 'confirm';

/** Settings > Account Security - change own password. */
export default function SettingsPage() {
    const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', confirm: '' });
    const [visible, setVisible] = useState<Record<Field, boolean>>({ current: false, next: false, confirm: false });
    const [showAll, setShowAll] = useState(false);
    const [busy, setBusy] = useState(false);

    const show = (text: string, ok: boolean) => (ok ? ArchonAlert.success(text) : ArchonAlert.error(text));

    const toggleAll = (checked: boolean) => {
        setShowAll(checked);
        setVisible({ current: checked, next: checked, confirm: checked });
    };

    const submit = async () => {
        const { current, next, confirm } = values;
        if (!current || !next || !confirm) { void show('Please fill in all password fields.', false); return; }
        if (next.length < 8) { void show('New password must be at least 8 characters long.', false); return; }
        if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) { void show('New password must contain at least one letter and one number.', false); return; }
        if (next !== confirm) { void show('New password and confirmation do not match.', false); return; }
        if (next === current) { void show('New password must be different from your current password.', false); return; }

        setBusy(true);
        try {
            const res = await employeeService.changePassword(current, next, confirm);
            void show(res.message || 'Your password has been changed successfully.', true);
            setValues({ current: '', next: '', confirm: '' });
            toggleAll(false);
        } catch (err) {
            void show(err instanceof Error && err.message ? err.message : 'Could not change your password.', false);
        } finally {
            setBusy(false);
        }
    };

    const input = (field: Field, id: string, label: string, placeholder: string, autoComplete: string, full = false) => (
        <div className={`form-group${full ? ' full-width' : ''}`}>
            <label htmlFor={id}>{label} <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div className="input-password-wrap">
                <input type={visible[field] ? 'text' : 'password'} className="form-input" id={id} autoComplete={autoComplete} placeholder={placeholder}
                    value={values[field]} onChange={e => setValues({ ...values, [field]: e.target.value })} />
                <button type="button" className="btn-toggle-pw" aria-label={visible[field] ? 'Hide password' : `Toggle ${label} visibility`} title="Show/Hide Password"
                    onClick={() => setVisible({ ...visible, [field]: !visible[field] })}>
                    <Icon as={visible[field] ? Eye : EyeOff} />
                </button>
            </div>
        </div>
    );

    return (
        <Page id="settings">
            <PageHeader title="Settings" subtitle="Manage your employee account settings and security preferences" />
            <div className="settings-container">
                <div className="card hover-card" id="accountSecurityCard">
                    <div className="card-header">
                        <h3 className="card-title"><Icon as={Lock} /> Account Security</h3>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Change the password for your HRMS account. You can do this at any time.</p>
                        <div className="modal-form-grid">
                            {input('current', 'cpCurrent', 'Current Password', 'Enter your current password', 'current-password', true)}
                            {input('next', 'cpNew', 'New Password', 'Enter new password', 'new-password')}
                            {input('confirm', 'cpConfirm', 'Confirm New Password', 'Confirm new password', 'new-password')}
                        </div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <label className="checkbox-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                                <input type="checkbox" id="cpShowPasswords" checked={showAll} onChange={e => toggleAll(e.target.checked)} />
                                <span>Show passwords</span>
                            </label>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>At least 8 characters, including one letter and one number. Must differ from your current password.</p>
                        </div>
                        <div style={{ marginTop: '1.25rem' }}>
                            <button type="button" className="btn btn-primary" id="cpSubmit" disabled={busy} onClick={() => void submit()}><Icon as={Save} /> Change Password</button>
                        </div>
                    </div>
                </div>
            </div>
        </Page>
    );
}
