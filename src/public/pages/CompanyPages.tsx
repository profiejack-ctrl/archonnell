import { useEffect } from 'react';
import { Clock, Mail, MapPin } from 'lucide-react';
import { PageHero, PartnersSection, ProductsSection, ProjectsSection } from './sections';
import { HRMS_LOGIN_URL } from '../layouts/SiteHeader';
import { usePageMeta } from '../hooks';

/** Homepage/Pages/about.php */
export function AboutPage() {
    usePageMeta('About Us', 'Learn about Archon Nell Incorporated - Engineering reliable solutions for demanding industrial environments.');
    return (
        <>
            <PageHero title="About Us">
                Engineering reliable solutions for demanding
                industrial environments.
            </PageHero>

            <section className="intro">
                <div className="container">
                    <div className="section-label">OUR COMPANY</div>
                    <h2 className="section-title">Built on expertise and reliability.</h2>
                    <p className="section-description">
                        Archon Nell Incorporated is focused on delivering
                        dependable engineering, construction, chemical,
                        and industrial solutions.
                    </p>
                </div>
            </section>

            <section className="about">
                <div className="container about-grid">
                    <div className="about-image"></div>
                    <div className="about-content">
                        <h2>Our commitment</h2>
                        <p>
                            We work closely with clients to understand their
                            operational challenges and develop practical,
                            long-lasting solutions.
                        </p>
                        <p>
                            Our approach combines technical knowledge,
                            quality materials, experienced people, and
                            continuous improvement.
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}

/** Homepage/Pages/projects.php */
export function ProjectsPage() {
    usePageMeta('Projects', 'Explore the industrial and infrastructure projects of Archon Nell Incorporated.');
    return (
        <>
            <PageHero title="Projects">
                A selection of industrial environments and applications where our expertise makes a difference.
            </PageHero>
            <ProjectsSection />
        </>
    );
}

/** Homepage/Pages/products.php */
export function ProductsPage() {
    usePageMeta('Products', 'High-performance construction chemicals, protective coatings, and industrial solutions from Archon Nell Incorporated.');
    return (
        <>
            <PageHero title="Our Products">Built for performance, engineered for reliability.</PageHero>
            <ProductsSection />
        </>
    );
}

/** Homepage/Pages/partners.php */
export function PartnersPage() {
    usePageMeta('Partners', 'Our industry partners and trusted network at Archon Nell Incorporated.');
    return (
        <>
            <PageHero title="Our Partners">Collaborating with industry leaders to deliver exceptional results.</PageHero>
            <PartnersSection />
        </>
    );
}

/** Homepage/Pages/contact.php */
export function ContactPage() {
    usePageMeta('Contact Us', 'Get in touch with Archon Nell Incorporated. Located in Metro Manila, Philippines.');
    return (
        <>
            <PageHero title="Contact Us">
                We would love to hear from you. Reach out for inquiries, consultations, or partnerships.
            </PageHero>

            <section className="intro">
                <div className="container">
                    <div className="section-label">GET IN TOUCH</div>
                    <h2 className="section-title">Contact Information</h2>
                    <p className="section-description">
                        Reach out to us through any of the channels below. Our team is ready to assist you.
                    </p>

                    <div className="cards" style={{ marginTop: 50 }}>
                        <article className="card">
                            <div className="card-icon"><MapPin /></div>
                            <h3>Address</h3>
                            <p>
                                Head Office and Plant<br />
                                Plant 2,#1024 industrial Park,<br />
                                Felix Ave. Brgy, Sto Domingo Cainta,<br />
                                1900 Rizal Metro Manila, Philippines<br />
                            </p>
                        </article>

                        <article className="card">
                            <div className="card-icon"><Mail /></div>
                            <h3>Email &amp; Phone</h3>
                            <p>
                                <strong>Email:</strong><br />
                                archonnell.inc@archonnell.com<br /><br />
                                <strong>Phone:</strong><br />
                                +632 8682 6053
                            </p>
                        </article>

                        <article className="card">
                            <div className="card-icon"><Clock /></div>
                            <h3>Office Hours</h3>
                            <p>
                                Monday - Friday<br />
                                9:00 AM - 6:00 PM<br /><br />
                                Closed on weekends and public holidays.
                            </p>
                        </article>
                    </div>
                </div>
            </section>
        </>
    );
}

/** Homepage/Pages/employee-portal.php - notice, then on to the HRMS login. */
export function EmployeePortalPage() {
    usePageMeta('Employee Portal', 'Employee portal for Archon Nell Incorporated staff.');

    // Homepage -> Employee Portal -> Login Page
    useEffect(() => {
        const t = window.setTimeout(() => { window.location.href = HRMS_LOGIN_URL; }, 1200);
        return () => window.clearTimeout(t);
    }, []);

    return (
        <>
            <PageHero title="Employee Portal">Secure access for Archon Nell employees.</PageHero>

            <section className="intro">
                <div className="container">
                    <div style={{ background: '#bce5fb', color: '#14588d', padding: '30px 35px', borderRadius: 8, borderLeft: '5px solid #0879bc', textAlign: 'left', maxWidth: 750, margin: '0 auto' }}>
                        <div className="section-label" style={{ marginBottom: 12 }}>NOTICE</div>
                        <p style={{ fontSize: 15, lineHeight: 1.7 }}>
                            Employee portal access is restricted to authorized personnel only. Please login with your company credentials.
                        </p>
                        <div style={{ marginTop: 22 }}>
                            <a href={HRMS_LOGIN_URL} className="btn btn-primary">Proceed to Employee Login</a>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
