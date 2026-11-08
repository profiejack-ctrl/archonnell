import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Briefcase, CalendarClock, Laptop, MapPin, Users } from 'lucide-react';
import JobPostingView from '../../components/JobPostingView';
import { PageHero } from './sections';
import { usePageMeta } from '../hooks';
import { portalService } from '../../services/portalService';
import { phpFjY } from '../../utils/format';
import type { JobPostingPublic } from '../../types/portal';

/** Careers: every Published job posting that accepts applications (from Recruitment Management > Job Posting). */
export function CareersPage() {
    usePageMeta('Careers', 'Archon Nell Incorporated - Job vacancies and careers.');
    const [jobs, setJobs] = useState<JobPostingPublic[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        portalService.jobs()
            .then(r => setJobs(r.jobs ?? []))
            .catch(err => { setJobs([]); setError(err instanceof Error ? err.message : 'Job openings could not be loaded.'); });
    }, []);

    return (
        <>
            <PageHero title="Careers">
                Build the future of industry with us. Explore our open positions and apply online.
            </PageHero>

            <section className="careers-page">
                <div className="container">
                    <div className="center-heading reveal">
                        <div className="section-label">JOB VACANCIES</div>
                        <h2 className="section-title">Open Positions</h2>
                        <p className="section-description">Choose a position to see its details and apply. Our AI screening checks your resume against that job&apos;s requirements.</p>
                    </div>

                    {jobs === null && <p className="jobs-state">Loading job openings…</p>}
                    {jobs !== null && jobs.length === 0 && (
                        <p className="jobs-state">{error || 'There are no open positions right now. Please check back soon.'}</p>
                    )}

                    <div className="jobs-list">
                        {jobs?.map(job => (
                            <article className="job-card reveal" key={job.posting_no}>
                                <div className="job-card-no">{job.posting_no}</div>
                                <h3 className="job-card-title">{job.title}</h3>
                                {job.department && <div className="job-card-dept">{job.department}</div>}
                                <ul className="job-card-meta">
                                    {job.employment_type && <li><Briefcase /> {job.employment_type}</li>}
                                    {job.work_setup && <li><Laptop /> {job.work_setup}</li>}
                                    {job.location && <li><MapPin /> {job.location}</li>}
                                    {job.vacancies && <li><Users /> {job.vacancies} {job.vacancies === 1 ? 'vacancy' : 'vacancies'}</li>}
                                </ul>
                                {job.description && (
                                    <p className="job-card-desc">{job.description.length > 170 ? `${job.description.slice(0, 170).trim()}…` : job.description}</p>
                                )}
                                <div className="job-card-foot">
                                    <span className="job-card-deadline"><CalendarClock /> {job.deadline ? `Apply before ${phpFjY(job.deadline)}` : 'Open until filled'}</span>
                                    <Link to={`/careers/${job.posting_no}`} className="btn btn-primary">View Details</Link>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="jobs-cta reveal">
                        <p>Not sure which role fits you best? Upload your resume and our AI will recommend the positions that match your profile.</p>
                        <Link to="/apply" className="btn btn-primary">Apply &amp; Get AI Recommendations</Link>
                    </div>
                </div>
            </section>
        </>
    );
}

/** One job posting (careers/JP-2026-0001) -> Apply Now with the job already selected. */
export function JobPostingPage() {
    const { postingNo = '' } = useParams();
    const [job, setJob] = useState<JobPostingPublic | null | undefined>(undefined);
    const [message, setMessage] = useState('');
    usePageMeta(job ? job.title : 'Job Opening', 'Archon Nell Incorporated - Job opening details.');

    useEffect(() => {
        setJob(undefined);
        portalService.jobPosting(postingNo)
            .then(r => { setJob(r.posting); setMessage(r.message || ''); })
            .catch(err => { setJob(null); setMessage(err instanceof Error ? err.message : 'This job posting could not be loaded.'); });
    }, [postingNo]);

    return (
        <section className="careers-page job-detail-page">
            <div className="container">
                <Link to="/careers" className="text-link job-back-link">← All job openings</Link>
                {job === undefined && <p className="jobs-state">Loading job posting…</p>}
                {job === null && (
                    <div className="jobs-unavailable">
                        <h2>Job posting not available</h2>
                        <p>{message || 'This job posting is not available.'}</p>
                        <Link to="/careers" className="btn btn-primary">View Open Positions</Link>
                    </div>
                )}
                {job && (
                    <JobPostingView job={job} action={job.job_id
                        ? <Link to={`/apply?job=${job.job_id}`} className="jpv-apply-btn">APPLY NOW</Link>
                        : <button type="button" className="jpv-apply-btn" disabled>Applications closed</button>} />
                )}
            </div>
        </section>
    );
}
