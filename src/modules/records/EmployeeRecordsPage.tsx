import { useRef, useState } from 'react';
import { Award, Download, Eye, File, FileSpreadsheet, FileText, FileType, FolderOpen, Image, Upload, type LucideIcon } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { employeeService } from '../../services/employeeService';
import { backendUrl } from '../../services/http';
import { ArchonAlert } from '../../utils/alerts';
import { ViewEmployeeModal, toEmployeeView, type EmployeeView } from '../hcm/EmployeeModals';
import { STATUS_BADGE } from '../hcm/EmployeeDirectoryPage';
import type { DocType, EmployeeDocument } from '../../types';

const DOC_TYPES: DocType[] = ['resume', 'contract', 'certificate', 'valid_id'];
const DOC_TYPE_LABELS: Record<DocType, string> = { resume: 'Resume', contract: 'Employee Contract', certificate: 'Certificate', valid_id: 'Valid ID' };
const DOC_ICONS: Record<DocType, LucideIcon> = { resume: FileType, contract: FileText, certificate: Award, valid_id: Image };

interface DocModalState { employeeId: number; name: string; presetType: DocType | null; lockType: boolean }

function DocCellButton({ type, count, onClick }: { type: DocType; count: number; onClick: () => void }) {
    const label = count > 0 ? `${count} File${count > 1 ? 's' : ''}` : 'No File';
    return (
        <button type="button" className={`btn btn-sm ${count > 0 ? 'btn-outline' : 'btn-outline muted-doc-btn'} btn-doc-view`} data-doc-type={type} onClick={onClick}>
            <Icon as={DOC_ICONS[type]} /> {label}
        </button>
    );
}

/** Employee Records Management - secure document storage and records tracking. */
export default function EmployeeRecordsPage() {
    const { data, loading, error, retry, reload } = usePageData(employeeService.recordsPage);
    const filters = useFilters({ search: '', status: '', department: '', position: '', contract: '', from: '', to: '' });
    const f = filters.values;
    const [viewing, setViewing] = useState<EmployeeView | null>(null);
    const [docModal, setDocModal] = useState<DocModalState | null>(null);
    const [docs, setDocs] = useState<{ state: 'loading' | 'error' | 'ready'; message?: string; items?: Record<DocType, EmployeeDocument[]> }>({ state: 'loading' });
    const [uploadType, setUploadType] = useState<DocType>('resume');
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const counts = data?.doc_counts ?? {};
    const docCount = (id: number, t: DocType) => (counts[String(id)] ?? {})[t] ?? 0;
    const view = useTableView(data?.employees, e => matchesText(f.search, e.full_name, e.employee_no, e.department, e.position)
        && is(f.status, e.employment_status) && is(f.department, e.department) && is(f.position, e.position) && is(f.contract, e.contract_type)
        && inDateRange(e.date_hired, f.from, f.to), {
        no: e => e.employee_no, name: e => e.full_name, department: e => `${e.department} ${e.position}`, status: e => e.employment_status, hired: e => e.date_hired,
        resume: e => docCount(e.id, 'resume'), contract: e => docCount(e.id, 'contract'), certificate: e => docCount(e.id, 'certificate'), valid_id: e => docCount(e.id, 'valid_id'),
    });

    const openDocuments = async (employeeId: number, name: string, presetType: DocType | null, lockType: boolean) => {
        if (presetType) setUploadType(presetType);
        if (fileRef.current) fileRef.current.value = '';
        setDocModal({ employeeId, name, presetType, lockType });
        setDocs({ state: 'loading' });
        try {
            const { documents } = await employeeService.documents(employeeId);
            setDocs({ state: 'ready', items: documents });
        } catch (err) {
            setDocs({ state: 'error', message: err instanceof Error ? err.message : 'Request failed' });
        }
    };

    const downloadAll = (employeeId: number, name: string) => {
        const c = counts[String(employeeId)] ?? {};
        if (!DOC_TYPES.some(t => (c[t] ?? 0) > 0)) {
            void ArchonAlert.info(`No documents have been uploaded yet for ${name || 'this employee'}.`);
            return;
        }
        window.location.href = backendUrl(`download-employee-documents-zip.php?employee_id=${encodeURIComponent(String(employeeId))}`);
    };

    const upload = async () => {
        if (!docModal) return;
        const file = fileRef.current?.files?.[0];
        if (!file) {
            await ArchonAlert.warning('Please choose a file first.', { title: 'No File Selected' });
            return;
        }
        setUploading(true);
        try {
            await employeeService.uploadDocument(docModal.employeeId, uploadType, file);
            setDocModal(null);
            await ArchonAlert.success('Document uploaded successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error && err.message ? err.message : 'Upload failed. Please try again.', { title: 'Upload Failed' });
        } finally {
            setUploading(false);
        }
    };

    const listTypes = docModal?.presetType ? [docModal.presetType] : DOC_TYPES;

    return (
        <Page id="employee-records">
            <PageHeader title="Employee Records Management" subtitle="Secure document storage and records tracking" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox id="recordsSearch" value={f.search} onChange={filters.set('search')} placeholder="Search name, employee ID..." />
                            <select className="form-select" id="recordsStatusFilter" aria-label="Employment status" value={f.status} onChange={e => filters.set('status')(e.target.value)}>
                                <option value="">All Employees</option>
                                <option value="Active">Active Employees</option>
                                <option value="Inactive">Archived Employees</option>
                            </select>
                            <FilterSelect id="recordsDeptFilter" label="Departments" value={f.department} onChange={filters.set('department')} options={distinct(data.employees, e => e.department)} />
                            <FilterSelect id="recordsPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(data.employees, e => e.position)} />
                            <FilterSelect id="recordsContractFilter" label="Contracts" value={f.contract} onChange={filters.set('contract')} options={distinct(data.employees, e => e.contract_type)} />
                            <DateRangeFilter id="recordsHired" label="Hired" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="recordsClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={view.rows.length} total={view.total} />
                        </div>
                        <button className="btn btn-primary" id="btnExportEmployees" onClick={() => { window.location.href = backendUrl('export-employees.php'); }}>
                            <Icon as={FileSpreadsheet} /> Export
                        </button>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="employeeRecordsTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="no">Employee ID</SortTh><SortTh view={view} k="name">Employee</SortTh><SortTh view={view} k="department">Department &amp; Position</SortTh><SortTh view={view} k="status">Status</SortTh>
                                        <SortTh view={view} k="resume">Resume</SortTh><SortTh view={view} k="contract">Contract</SortTh><SortTh view={view} k="certificate">Certificates</SortTh><SortTh view={view} k="valid_id">Valid ID</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!data.employees.length ? (
                                        <EmptyRow colSpan={9}>No employee records yet.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={9}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map((e, i) => {
                                        const c = counts[String(e.id)] ?? {};
                                        return (
                                            <tr className="hover-row" key={e.id} data-employee-id={e.id}>
                                                <td><strong>{e.employee_no}</strong></td>
                                                <td><PersonCell index={i} name={e.full_name} /></td>
                                                <td>{e.department} <span style={{ color: 'var(--text-muted)' }}>&middot;</span> {e.position}</td>
                                                <td><Badge variant={STATUS_BADGE[e.employment_status] ?? 'badge-info'}>{e.employment_status}</Badge></td>
                                                {DOC_TYPES.map(t => (
                                                    <td key={t}><DocCellButton type={t} count={c[t] ?? 0} onClick={() => void openDocuments(e.id, e.full_name || 'Employee', t, true)} /></td>
                                                ))}
                                                <td>
                                                    <button className="table-action-btn btn-view-record" title="View Record" onClick={() => setViewing(toEmployeeView(e))}><Icon as={Eye} /></button>
                                                    <button className="table-action-btn btn-upload-doc" title="Upload" onClick={() => void openDocuments(e.id, e.full_name || 'Employee', null, false)}><Icon as={Upload} /></button>
                                                    <button className="table-action-btn btn-download-all" title="Download All" onClick={() => downloadAll(e.id, e.full_name)}><Icon as={Download} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <ViewEmployeeModal employee={viewing} onClose={() => setViewing(null)} />

            <Modal open={!!docModal} onClose={() => setDocModal(null)} size="lg"
                title={<><Icon as={FolderOpen} /> Employee Documents - <span id="docModalEmployeeName">{docModal?.name ?? '-'}</span></>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setDocModal(null)}>Close</button>
                    <button className="btn btn-primary" id="docUploadSubmit" disabled={uploading} onClick={() => void upload()}><Icon as={Upload} /> Upload</button>
                </>}>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={FileText} /> On File</h4>
                    <div id="docModalList" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {docs.state === 'loading' && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading…</p>}
                        {docs.state === 'error' && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{docs.message}</p>}
                        {docs.state === 'ready' && listTypes.map(type => {
                            const files = docs.items?.[type] ?? [];
                            return (
                                <div style={{ marginBottom: '0.5rem' }} key={type}>
                                    <strong style={{ fontSize: '0.85rem' }}>{DOC_TYPE_LABELS[type]}</strong>
                                    {!files.length ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>No file uploaded yet.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem' }}>
                                            {files.map(f => (
                                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                    <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        <Icon as={File} /> {f.original_filename} <span style={{ color: 'var(--text-muted)' }}>({f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : ''}, {f.uploaded_at ? f.uploaded_at.substring(0, 10) : ''})</span>
                                                    </span>
                                                    <span style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                                        <a className="table-action-btn" title="View" href={backendUrl(`download-employee-document.php?id=${f.id}`)} target="_blank" rel="noopener"><Icon as={Eye} /></a>
                                                        <a className="table-action-btn" title="Download" href={backendUrl(`download-employee-document.php?id=${f.id}&download=1`)}><Icon as={Download} /></a>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Upload} /> Upload New</h4>
                    <form id="docUploadForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group full-width" id="docTypeGroup" style={{ opacity: docModal?.lockType ? 0.7 : 1 }}>
                            <label>Document Type</label>
                            <select className="form-input" id="docUploadType" value={uploadType} disabled={!!docModal?.lockType} onChange={e => setUploadType(e.target.value as DocType)}>
                                <option value="resume">Resume</option>
                                <option value="contract">Employee Contract</option>
                                <option value="certificate">Certificate</option>
                                <option value="valid_id">Valid ID</option>
                            </select>
                        </div>
                        <div className="form-group full-width">
                            <label>File</label>
                            <input type="file" className="form-input" id="docUploadFile" ref={fileRef} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF/DOC/DOCX up to 5MB (Valid ID also accepts JPG/PNG).</span>
                        </div>
                    </form>
                </div>
            </Modal>
        </Page>
    );
}
