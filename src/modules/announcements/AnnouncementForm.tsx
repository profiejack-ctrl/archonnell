import { useEffect, useRef, useState } from 'react';
import { Eye, FilePen, Info, Megaphone, Plus, Save, Send, Users } from 'lucide-react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { announcementService } from '../../services/announcementService';
import { backendUrl } from '../../services/http';
import { ArchonAlert } from '../../utils/alerts';
import { fmtDateTimeShort, toDatetimeLocal } from '../../utils/format';
import type { Announcement, Department } from '../../types';

export interface PreviewData {
    title: string;
    summary: string;
    body: string;
    publishedAt: string;
    coverImage: string;
    scopeAll: boolean;
    departments: string[];
    createdBy: string;
}

export function scopeText(scopeAll: boolean, departments: string[]): string {
    if (scopeAll) return 'All Employees';
    if (departments.length) return departments.join(', ');
    return '—';
}

/** "Announcement Preview" (Employee Dashboard view). */
export function PreviewModal({ data, onClose }: { data: PreviewData | null; onClose: () => void }) {
    const [shown, setShown] = useState<PreviewData | null>(null);
    useEffect(() => { if (data) setShown(data); }, [data]);
    const d = data ?? shown;
    return (
        <Modal open={!!data} onClose={onClose} size="lg" zIndex={2100} title={<><Icon as={Eye} /> Announcement Preview</>}
            footer={<button className="btn btn-outline" onClick={onClose}>Close Preview</button>}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Icon as={Info} style={{ color: 'var(--primary)' }} /> Preview Mode &mdash; Employee Dashboard View</span>
                <span id="annPreviewScopeBadge" className="badge badge-info">{d ? scopeText(d.scopeAll, d.departments) : 'All Employees'}</span>
            </div>
            <div id="annPreviewCoverWrap" style={{ display: d?.coverImage ? 'block' : 'none', marginBottom: '1rem' }}>
                {d?.coverImage && <img id="annPreviewCover" alt="Cover" src={d.coverImage} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />}
            </div>
            <h2 id="annPreviewTitle" style={{ marginBottom: '0.35rem' }}>{d?.title || '(Untitled announcement)'}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <span id="annPreviewDate">{d?.publishedAt ? fmtDateTimeShort(d.publishedAt) : 'Just now'}</span> &nbsp;&middot;&nbsp; Posted by <span id="annPreviewPostedBy">{d?.createdBy || 'Human Resources & Administration'}</span>
            </div>
            <div id="annPreviewSummary" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{d?.summary || ''}</div>
            <div id="annPreviewBody" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, marginBottom: '1rem' }}>{d?.body || ''}</div>
        </Modal>
    );
}

interface FormProps {
    open: boolean;
    editing: Announcement | null;
    departments: Department[];
    onClose: () => void;
    onSaved: (message: string) => void;
    onPreview: (data: PreviewData) => void;
}

/** Create / Edit announcement form, with the "Apply To" department picker. */
export function AnnouncementFormModal({ open, editing, departments, onClose, onSaved, onPreview }: FormProps) {
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [body, setBody] = useState('');
    const [publishedAt, setPublishedAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [showOnDashboard, setShowOnDashboard] = useState(false);
    const [scopeAll, setScopeAll] = useState(true);
    const [scopeDepts, setScopeDepts] = useState<string[]>([]);
    const [coverPath, setCoverPath] = useState('');
    const [coverPreview, setCoverPreview] = useState('');
    const [pendingCover, setPendingCover] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [applyOpen, setApplyOpen] = useState(false);
    const [applyMode, setApplyMode] = useState<'all' | 'dept'>('all');
    const [applyChecked, setApplyChecked] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Reset / load whenever the form opens.
    useEffect(() => {
        if (!open) return;
        const a = editing;
        setTitle(a?.title ?? '');
        setSummary(a?.summary ?? '');
        setBody(a?.body ?? '');
        setPublishedAt(a ? toDatetimeLocal(a.published_at) : '');
        setEndAt(a ? toDatetimeLocal(a.end_at) : '');
        setShowOnDashboard(!!a?.show_on_dashboard);
        setScopeAll(a ? !!a.scope_all : true);
        setScopeDepts(a ? [...(a.scope_departments ?? [])] : []);
        setCoverPath(a?.cover_image ?? '');
        setCoverPreview(a?.cover_image ? backendUrl(a.cover_image) : '');
        setPendingCover(null);
        if (fileRef.current) fileRef.current.value = '';
    }, [open, editing]);

    const isDraftEdit = !editing || editing.status === 'Draft';

    const onCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) { setPendingCover(null); return; }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            void ArchonAlert.warning('Please choose a JPG or PNG image.', { title: 'Invalid Image' });
            e.target.value = '';
            setPendingCover(null);
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            void ArchonAlert.warning('Image is too large. Maximum size is 5MB.', { title: 'Invalid Image' });
            e.target.value = '';
            setPendingCover(null);
            return;
        }
        setPendingCover(file);
        const reader = new FileReader();
        reader.onload = () => setCoverPreview(String(reader.result));
        reader.readAsDataURL(file);
    };

    const openApply = () => {
        setApplyMode(scopeAll ? 'all' : 'dept');
        setApplyChecked(scopeDepts);
        setApplyOpen(true);
    };

    const applyScope = () => {
        if (applyMode === 'all') {
            setScopeAll(true);
            setScopeDepts([]);
        } else {
            if (!applyChecked.length) {
                void ArchonAlert.warning('Please select at least one department, or choose All Employees.', { title: 'Missing Information' });
                return;
            }
            setScopeAll(false);
            setScopeDepts(applyChecked);
        }
        setApplyOpen(false);
    };

    const submit = async (isDraft: boolean) => {
        const t = title.trim();
        const b = body.trim();
        if (!t) { void ArchonAlert.warning('Announcement Name is required.', { title: 'Missing Information' }); return; }
        if (!isDraft) {
            if (!b) { void ArchonAlert.warning('Body is required.', { title: 'Missing Information' }); return; }
            if (!publishedAt) { void ArchonAlert.warning('Published Time is required.', { title: 'Missing Information' }); return; }
            if (showOnDashboard && !endAt) { void ArchonAlert.warning('End Time is required when Display on Dashboard is enabled.', { title: 'Missing Information' }); return; }
            if (endAt && new Date(endAt) <= new Date(publishedAt)) {
                void ArchonAlert.warning('End Time must be later than Published Time.', { title: 'Invalid Date' });
                return;
            }
        }
        setSaving(true);
        try {
            let cover = coverPath;
            if (pendingCover) cover = (await announcementService.uploadCover(pendingCover)).cover_image;
            const payload = {
                title: t,
                summary: summary.trim(),
                body: b,
                published_at: publishedAt ? publishedAt.replace('T', ' ') : '',
                end_at: endAt ? endAt.replace('T', ' ') : '',
                show_on_dashboard: showOnDashboard ? '1' as const : '0' as const,
                scope_all: scopeAll ? '1' as const : '0' as const,
                departments: scopeAll ? [] : scopeDepts,
                cover_image: cover,
                is_draft: isDraft ? '1' as const : '0' as const,
                status: isDraft ? 'Draft' : '',
            };
            if (editing) await announcementService.update(editing.id, payload);
            else await announcementService.create(payload);
            onSaved(isDraft ? 'Announcement saved as a draft.' : (editing ? 'Announcement updated successfully.' : 'Announcement created successfully.'));
        } catch (err) {
            await ArchonAlert.error(err instanceof Error && err.message ? err.message : 'Could not save the announcement.');
        } finally {
            setSaving(false);
        }
    };

    const preview = () => onPreview({
        title: title.trim(),
        summary: summary.trim(),
        body,
        publishedAt,
        coverImage: coverPreview || (coverPath ? backendUrl(coverPath) : ''),
        scopeAll,
        departments: scopeDepts,
        createdBy: 'Human Resources & Administration',
    });

    return (
        <>
            <Modal open={open} onClose={onClose} size="lg" title={<><Icon as={Megaphone} /> <span id="annFormTitle">{editing ? 'Edit Announcement' : 'Create Announcement'}</span></>}
                footer={<>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-outline" id="annBtnFormPreview" onClick={preview}><Icon as={Eye} /> Preview</button>
                    {isDraftEdit && (
                        <button type="button" className="btn btn-outline" id="annBtnSaveDraft" disabled={saving} onClick={() => void submit(true)}><Icon as={FilePen} /> Save as Draft</button>
                    )}
                    <button type="button" className="btn btn-primary" id="annBtnSave" disabled={saving} onClick={() => void submit(false)}>
                        {isDraftEdit ? <><Icon as={Send} /> Publish</> : <><Icon as={Save} /> Save Changes</>}
                    </button>
                </>}>
                <form id="announcementForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                    <div className="form-group full-width">
                        <label>Announcement Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="text" className="form-input" id="annTitle" placeholder="e.g., System Maintenance Schedule" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div className="form-group full-width">
                        <label>Summary</label>
                        <input type="text" className="form-input" id="annSummary" maxLength={255} placeholder="Short summary shown in the list and on the dashboard"
                            value={summary} onChange={e => setSummary(e.target.value)} />
                    </div>
                    <div className="form-group full-width">
                        <label>Choose Cover Image</label>
                        <input type="file" className="form-input" id="annCoverFile" ref={fileRef} accept="image/jpeg,image/png" onChange={onCoverChange} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JPG or PNG, up to 5MB.</span>
                        <div id="annCoverPreviewWrap" style={{ marginTop: '0.5rem', display: coverPreview ? 'block' : 'none' }}>
                            {coverPreview && <img id="annCoverPreview" alt="Cover preview" src={coverPreview} style={{ maxWidth: 220, maxHeight: 120, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />}
                        </div>
                    </div>
                    <div className="form-group full-width">
                        <label>Body <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <textarea className="form-input" id="annBody" style={{ minHeight: 150, resize: 'vertical' }} placeholder="Full announcement content"
                            value={body} onChange={e => setBody(e.target.value)}></textarea>
                    </div>
                    <div className="form-group">
                        <label>Published Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="datetime-local" className="form-input" id="annPublishedAt" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" id="annShowOnDashboard" style={{ width: 'auto' }} checked={showOnDashboard} onChange={e => setShowOnDashboard(e.target.checked)} />
                            Show on Employee Dashboard
                        </label>
                    </div>
                    <div className="form-group" id="annEndAtWrap" style={{ display: showOnDashboard ? 'block' : 'none' }}>
                        <label>End Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input type="datetime-local" className="form-input" id="annEndAt" value={endAt} onChange={e => setEndAt(e.target.value)} />
                    </div>
                    <div className="form-group full-width">
                        <label>Applied To</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span id="annScopeSummary" style={{ color: 'var(--text-secondary)' }}>{scopeText(scopeAll, scopeDepts)}</span>
                            <button type="button" className="btn btn-sm btn-outline" id="annBtnAddScope" onClick={openApply}><Icon as={Plus} /> Add</button>
                        </div>
                    </div>
                </form>
            </Modal>

            <Modal open={applyOpen} onClose={() => setApplyOpen(false)} zIndex={2100} title={<><Icon as={Users} /> Apply To</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setApplyOpen(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="annBtnApplyScope" onClick={applyScope}>Apply</button>
                </>}>
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Choose which employees should see this announcement.</p>
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="radio" name="annScopeMode" id="annScopeModeAll" value="all" style={{ width: 'auto' }} checked={applyMode === 'all'} onChange={() => setApplyMode('all')} /> All Employees
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input type="radio" name="annScopeMode" id="annScopeModeDept" value="dept" style={{ width: 'auto' }} checked={applyMode === 'dept'} onChange={() => setApplyMode('dept')} /> Specific Departments
                    </label>
                </div>
                <div id="annDeptCheckboxList" style={{ display: applyMode === 'dept' ? 'block' : 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', maxHeight: 220, overflowY: 'auto', marginTop: '0.5rem' }}>
                    {departments.map(d => (
                        <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                            <input type="checkbox" className="ann-dept-checkbox" value={d.name} style={{ width: 'auto' }} checked={applyChecked.includes(d.name)}
                                onChange={e => setApplyChecked(c => (e.target.checked ? [...c, d.name] : c.filter(x => x !== d.name)))} /> {d.name}
                        </label>
                    ))}
                    {!departments.length && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No departments found.</p>}
                </div>
            </Modal>
        </>
    );
}
