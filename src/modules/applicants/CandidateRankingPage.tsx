import { useMemo, useState } from 'react';
import { BarChart2, Eye, StarHalf, Trophy } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { applicantService } from '../../services/applicantService';
import { applicantNo, datePart } from '../../utils/format';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import { toResumeTarget } from './ApplicantValidationPage';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, inDateRange, matchesText, useFilters, useTableView } from '../../components/TableControls';

const TIERS = [{ value: '2', label: 'Top Tier (70%+)' }, { value: '1', label: 'Mid Tier (45-69%)' }, { value: '0', label: 'Below 45%' }];
import type { RankedCandidate } from '../../types';

function RankCell({ rank }: { rank: number }) {
    if (rank === 1) return <Badge variant="badge-success" style={{ fontSize: '0.85rem', fontWeight: 700 }}>#1</Badge>;
    if (rank === 2) return <Badge variant="badge-info" style={{ fontSize: '0.85rem', fontWeight: 700 }}>#2</Badge>;
    if (rank === 3) return <Badge variant="badge-warning" style={{ fontSize: '0.85rem', fontWeight: 700 }}>#3</Badge>;
    return <strong style={{ color: '#6b7280' }}>#{rank}</strong>;
}

/** 0 = below 45, 1 = 45-69, 2 = 70 and above (same thresholds as the tier cards). */
const tierOf = (score: number) => (score >= 70 ? 2 : score >= 45 ? 1 : 0);

type SortKey = 'overall' | 'resume' | 'fit' | 'quality' | 'date';

const SCORE_OF: Record<Exclude<SortKey, 'date'>, (c: RankedCandidate) => number> = {
    overall: c => c.overall_score,
    resume: c => c.resume_score ?? -1,
    fit: c => c.role_fit,
    quality: c => c.quality_of_hire ?? -1,
};

/** Shown when a score's data is not available for this applicant. */
const NA = <span style={{ color: 'var(--text-muted)' }} title="Not enough data for this score">—</span>;

/** Candidates are ranked within one Job Posting at a time (never across postings). */
const postingKey = (c: RankedCandidate) => (c.job_posting_id ? String(c.job_posting_id) : 'none');

function postingLabel(c: RankedCandidate): string {
    return c.job_posting_id ? `${c.job_posting_no} · ${c.job_posting_title ?? c.position}` : 'Not linked to a job posting';
}

/**
 * Applicant Management > Candidate Ranking - applicants still in the hiring
 * pipeline, ranked by their AI scores (see wf_candidate_scores in
 * config/workflow.php for how each score is calculated).
 */
export default function CandidateRankingPage() {
    const { data, loading, error, retry } = usePageData(applicantService.rankingPage);
    const filters = useFilters({ search: '', tier: '', from: '', to: '' });
    const f = filters.values;
    const [sort, setSort] = useState<SortKey>('overall');
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [posting, setPosting] = useState('');

    // The job postings that have candidates, most candidates first.
    const postings = useMemo(() => {
        const groups = new Map<string, { key: string; label: string; count: number }>();
        for (const c of data?.candidates ?? []) {
            const g = groups.get(postingKey(c)) ?? { key: postingKey(c), label: postingLabel(c), count: 0 };
            g.count++;
            groups.set(g.key, g);
        }
        return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }, [data]);
    const selected = postings.some(p => p.key === posting) ? posting : (postings[0]?.key ?? '');
    const candidates = useMemo(() => (data?.candidates ?? []).filter(c => postingKey(c) === selected), [data, selected]);

    // Cards for the selected posting (same thresholds as before).
    const stats = useMemo(() => ({
        top_tier: candidates.filter(c => c.overall_score >= 70).length,
        mid_tier: candidates.filter(c => c.overall_score >= 45 && c.overall_score < 70).length,
        avg_fit: candidates.length ? Math.round(candidates.reduce((n, c) => n + c.role_fit, 0) / candidates.length) : 0,
    }), [candidates]);

    // Rank follows the chosen order: highest score first (ties: newest application first),
    // or newest application first for "Date Applied".
    const sorted = useMemo(() => {
        const list = [...candidates];
        const date = (c: RankedCandidate) => String(c.applied_at ?? '');
        list.sort(sort === 'date'
            ? (a, b) => date(b).localeCompare(date(a)) || b.overall_score - a.overall_score
            : (a, b) => SCORE_OF[sort](b) - SCORE_OF[sort](a) || b.overall_score - a.overall_score || date(b).localeCompare(date(a)));
        return list;
    }, [candidates, sort]);
    const rankOf = useMemo(() => new Map(sorted.map((c, i) => [c.id, i + 1])), [sorted]);
    // Filters narrow the ranked list; the column headers re-order it (the rank number stays).
    const view = useTableView(sorted, c => matchesText(f.search, applicantNo(c), c.full_name, c.position, c.email)
        && (!f.tier || String(tierOf(c.overall_score)) === f.tier) && inDateRange(c.applied_at, f.from, f.to), {
        rank: c => rankOf.get(c.id), no: c => applicantNo(c), name: c => c.full_name, position: c => c.position, resume: c => c.resume_score,
        applied: c => c.applied_at, fit: c => c.role_fit, quality: c => c.quality_of_hire, overall: c => c.overall_score,
    });

    return (
        <Page id="candidate-ranking">
            <PageHeader title="Candidate Ranking" subtitle="Applicants ranked within each job posting, based on resume, date applied, role fit and quality of hire insights" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={Trophy} gradient={['#10b981', '#059669']} value={stats.top_tier} label="Top Tier Candidates" />
                        <StatCard icon={StarHalf} gradient={['#f59e0b', '#d97706']} value={stats.mid_tier} label="Mid Tier Candidates" />
                        <StatCard icon={BarChart2} gradient={['#8b5cf6', '#7c3aed']} value={`${stats.avg_fit}%`} label="Average Fit Score" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <select className="form-select" id="candidateRankPosting" title="Job Posting" value={selected}
                                onChange={e => setPosting(e.target.value)} disabled={!postings.length}>
                                {!postings.length && <option value="">No job postings with candidates</option>}
                                {postings.map(p => <option key={p.key} value={p.key}>{p.label} ({p.count})</option>)}
                            </select>
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search name, applicant ID..." />
                            <select className="form-select" id="candidateRankSort" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                                <option value="overall">Sort by: Overall Score</option>
                                <option value="resume">Sort by: Resume Score</option>
                                <option value="fit">Sort by: Role Fit</option>
                                <option value="quality">Sort by: Quality of Hire</option>
                                <option value="date">Sort by: Date Applied (Newest)</option>
                            </select>
                            <FilterSelect id="candidateRankTier" label="Tiers" value={f.tier} onChange={filters.set('tier')} options={TIERS} />
                            <DateRangeFilter id="candidateRankDate" label="Applied" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="candidateRankClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={view.rows.length} total={view.total} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="candidateRankingTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="rank">Rank</SortTh><SortTh view={view} k="no">Applicant ID</SortTh><SortTh view={view} k="name">Name</SortTh>
                                        <SortTh view={view} k="position">Position Applied</SortTh><SortTh view={view} k="resume">Resume Score</SortTh>
                                        <SortTh view={view} k="applied">Date Applied</SortTh><SortTh view={view} k="fit">Role Fit</SortTh>
                                        <SortTh view={view} k="quality">Quality of Hire</SortTh><SortTh view={view} k="overall">Overall</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!sorted.length ? (
                                        <EmptyRow colSpan={10}>No AI-ranked candidates yet. Applicants are ranked automatically once their application (with AI resume screening and job match) is submitted, until they are hired or rejected.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={10}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map(cr => {
                                        // The avatar colour stays with the row's position in the server order.
                                        const i = data.candidates.indexOf(cr);
                                        const rank = rankOf.get(cr.id) ?? 0;
                                        const fitTier = tierOf(cr.role_fit);
                                        const overallTier = tierOf(cr.overall_score);
                                        const resumeText = cr.resume_score === null ? '' : `${cr.resume_score}%`;
                                        const qohText = cr.quality_of_hire === null ? '' : `${['Low', 'Medium', 'High'][tierOf(cr.quality_of_hire)]} (${cr.quality_of_hire}%)`;
                                        const fitText = `${['Fair', 'Good', 'Excellent'][fitTier]} (${cr.role_fit}%)`;
                                        return (
                                            <tr className="hover-row" key={cr.id} data-rank={rank}>
                                                <td><RankCell rank={rank} /></td>
                                                <td><strong>{applicantNo(cr)}</strong></td>
                                                <td><PersonCell index={i} name={cr.full_name} /></td>
                                                <td>{cr.position}</td>
                                                <td>{cr.resume_score === null ? NA : <Badge variant={['badge-warning', 'badge-info', 'badge-success'][tierOf(cr.resume_score)]}>{resumeText}</Badge>}</td>
                                                <td>{datePart(cr.applied_at)}</td>
                                                <td><Badge variant={['badge-info', 'badge-warning', 'badge-success'][fitTier]}>{fitText}</Badge></td>
                                                <td>{cr.quality_of_hire === null ? NA : <Badge variant={['badge-warning', 'badge-info', 'badge-success'][tierOf(cr.quality_of_hire)]}>{qohText}</Badge>}</td>
                                                <td><strong style={{ color: ['#6b7280', '#f59e0b', '#10b981'][overallTier] }}>{cr.overall_score}%</strong></td>
                                                <td>
                                                    <button className="table-action-btn btn-view-candidate" title="View Details" onClick={() => setResume(toResumeTarget(cr))}>
                                                        <Icon as={Eye} />
                                                    </button>
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
            <ResumeModal target={resume} onClose={() => setResume(null)} />
        </Page>
    );
}
