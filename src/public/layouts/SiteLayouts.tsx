import { Fragment, useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { useReveal, useScrollTopOnNavigate } from '../hooks';

/** Company pages (Home, About, Projects, Products, Partners, Contact, Employee Portal). */
export function PublicLayout() {
    useScrollTopOnNavigate();
    useReveal(0.12);
    return (
        <>
            <SiteHeader variant="public" />
            <main className="public-main">
                <Outlet />
            </main>
            <SiteFooter variant="public" />
        </>
    );
}

/** Applicant flow pages (Apply -> AI Screening -> Recommendation -> Review -> Submitted). */
export function ApplicantLayout() {
    useScrollTopOnNavigate();
    useReveal(0.08);
    useEffect(() => {
        document.body.classList.add('applicant-body');
        return () => document.body.classList.remove('applicant-body');
    }, []);
    return (
        <>
            <SiteHeader variant="applicant" />
            <Outlet />
            <SiteFooter variant="applicant" />
        </>
    );
}

const STEPS = ['Applicant', 'AI Screening', 'Recommendation', 'Review & Submit'];

/** The 4-step applicant progress tracker (includes/header.php, $showProgress). */
export function ProgressTracker({ currentStep }: { currentStep: number }) {
    return (
        <section className="progress-section">
            <div className="container">
                <div className="progress-tracker">
                    {STEPS.map((label, i) => {
                        const step = i + 1;
                        const last = step === STEPS.length;
                        const cls = ['progress-step', currentStep >= step ? 'active' : '', !last && currentStep > step ? 'completed' : '']
                            .filter(Boolean).join(' ');
                        return (
                            <Fragment key={label}>
                                <div className={cls}>
                                    <div className="step-number">{step}</div>
                                    <div className="step-label">{label}</div>
                                </div>
                                {!last && <div className={currentStep > step ? 'progress-line filled' : 'progress-line'}></div>}
                            </Fragment>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/**
 * One applicant page: the progress tracker (when shown) followed by the page
 * inside <main class="applicant-main">, as the PHP header/footer wrapped it.
 */
export function ApplicantPage({ step, children }: { step?: number; children: ReactNode }) {
    return (
        <>
            {step !== undefined && <ProgressTracker currentStep={step} />}
            <main className="applicant-main">{children}</main>
        </>
    );
}
