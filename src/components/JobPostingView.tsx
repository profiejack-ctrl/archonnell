import type { ReactNode } from 'react';
import { Briefcase, CalendarClock, Laptop, MapPin, Users } from 'lucide-react';
import { phpFjY } from '../utils/format';
import type { JobPostingPublic } from '../types/portal';
import '../styles/job-posting-view.css';

/**
 * A job posting exactly as applicants see it: the public job page renders it
 * with a working Apply Now, the HR preview with a disabled one.
 */
export default function JobPostingView({ job, action }: { job: JobPostingPublic; action: ReactNode }) {
    const facts = [
        { icon: Briefcase, label: 'Employment Type', value: job.employment_type },
        { icon: Laptop, label: 'Work Setup', value: job.work_setup },
        { icon: MapPin, label: 'Location', value: job.location },
        { icon: Users, label: 'Vacancies', value: job.vacancies ? String(job.vacancies) : '' },
        { icon: CalendarClock, label: 'Apply Before', value: job.deadline ? phpFjY(job.deadline) : '' },
    ].filter(f => f.value);

    return (
        <article className="jpv">
            <header className="jpv-head">
                <div className="jpv-no">{job.posting_no}</div>
                <h1 className="jpv-title">{job.title || '(Untitled job posting)'}</h1>
                {job.department && <div className="jpv-dept">{job.department}</div>}
                {facts.length > 0 && (
                    <ul className="jpv-facts">
                        {facts.map(f => (
                            <li key={f.label}>
                                <f.icon />
                                <span><span className="jpv-fact-label">{f.label}</span><span className="jpv-fact-value">{f.value}</span></span>
                            </li>
                        ))}
                    </ul>
                )}
            </header>

            <div className="jpv-body">
                {job.description && (
                    <section className="jpv-section">
                        <h2>Job Description</h2>
                        <p className="jpv-text">{job.description}</p>
                    </section>
                )}
                {job.responsibilities.length > 0 && (
                    <section className="jpv-section">
                        <h2>Responsibilities</h2>
                        <ul className="jpv-list">{job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </section>
                )}
                {(job.qualifications.length > 0 || job.experience_required) && (
                    <section className="jpv-section">
                        <h2>Qualifications</h2>
                        {job.qualifications.length > 0 && <ul className="jpv-list">{job.qualifications.map((q, i) => <li key={i}>{q}</li>)}</ul>}
                        {job.experience_required && <p className="jpv-note"><strong>Experience:</strong> {job.experience_required}</p>}
                    </section>
                )}
                {(job.required_skills.length > 0 || job.preferred_skills.length > 0) && (
                    <section className="jpv-section">
                        <h2>Skills</h2>
                        {job.required_skills.length > 0 && (
                            <>
                                <h3>Required Skills</h3>
                                <div className="jpv-tags">{job.required_skills.map(s => <span key={s} className="jpv-tag">{s}</span>)}</div>
                            </>
                        )}
                        {job.preferred_skills.length > 0 && (
                            <>
                                <h3>Preferred Skills</h3>
                                <div className="jpv-tags">{job.preferred_skills.map(s => <span key={s} className="jpv-tag preferred">{s}</span>)}</div>
                            </>
                        )}
                    </section>
                )}
                {(job.salary || job.benefits.length > 0) && (
                    <section className="jpv-section">
                        <h2>Salary &amp; Benefits</h2>
                        {job.salary && <p className="jpv-salary">{job.salary}</p>}
                        {job.benefits.length > 0 && <ul className="jpv-list">{job.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>}
                    </section>
                )}

                <div className="jpv-apply">
                    <div className="jpv-deadline">
                        Application Deadline
                        <strong>{job.deadline ? phpFjY(job.deadline) : 'Open until filled'}</strong>
                    </div>
                    {action}
                </div>
            </div>
        </article>
    );
}
