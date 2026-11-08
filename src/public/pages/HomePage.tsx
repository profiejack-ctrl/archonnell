import { Link } from 'react-router-dom';
import HeroSlider from './HeroSlider';
import { PartnersSection, ProductsSection, ProjectsSection } from './sections';
import { usePageMeta } from '../hooks';

const SERVICES = [
    { n: '01', title: 'Engineering', text: 'Technical engineering solutions for industrial infrastructure, facilities, and specialized applications.' },
    { n: '02', title: 'Construction', text: 'Construction and maintenance services focused on durability, safety, efficiency, and quality execution.' },
    { n: '03', title: 'Chemical Solutions', text: 'Specialized chemical formulations designed to protect, strengthen, and extend the life of structures.' },
];

/** Public home page (Homepage/index.php). */
export default function HomePage() {
    usePageMeta('Home', 'Archon Nell Incorporated - Engineering, construction, chemical and industrial solutions.');

    return (
        <>
            <HeroSlider />

            <section className="industrial-strip"></section>

            <section className="intro reveal">
                <div className="container">
                    <div className="section-label">WHO WE ARE</div>
                    <h2 className="section-title">Industrial expertise. Built to last.</h2>
                    <p className="section-description">
                        Archon Nell Incorporated provides specialized
                        engineering, construction, chemical, and industrial
                        services to clients who demand quality, reliability,
                        and long-term performance.
                    </p>
                </div>
            </section>

            <section className="about">
                <div className="container about-grid">
                    <div className="about-image reveal"></div>
                    <div className="about-content reveal">
                        <div className="section-label">ABOUT ARCHON NELL</div>
                        <h2>Engineering solutions with purpose.</h2>
                        <p>
                            We combine technical expertise, practical
                            experience, and innovative materials to deliver
                            solutions for demanding industrial environments.
                        </p>
                        <p>
                            From infrastructure protection and chemical
                            formulation to construction and maintenance,
                            our team works closely with clients to deliver
                            measurable, dependable results.
                        </p>
                        <div className="stats">
                            <div className="stat"><strong>15+</strong><span>Years Experience</span></div>
                            <div className="stat"><strong>100+</strong><span>Projects Completed</span></div>
                            <div className="stat"><strong>24/7</strong><span>Technical Support</span></div>
                        </div>
                        <Link to="/about" className="text-link">Learn More →</Link>
                    </div>
                </div>
            </section>

            <section className="services">
                <div className="container">
                    <div className="center-heading reveal">
                        <div className="section-label">WHAT WE DO</div>
                        <h2 className="section-title">Our Core Services</h2>
                        <p className="section-description">
                            Specialized capabilities designed around the
                            needs of modern industrial operations.
                        </p>
                    </div>
                    <div className="cards">
                        {SERVICES.map(s => (
                            <article key={s.n} className="card reveal">
                                <div className="card-icon">{s.n}</div>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <ProjectsSection />
            <ProductsSection />
            <PartnersSection />

            <section className="contact-cta">
                <div className="container">
                    <div className="cta-content">
                        <div>
                            <div className="section-label">HAVE A PROJECT?</div>
                            <h2>Let's build something that lasts.</h2>
                        </div>
                        <Link to="/contact" className="btn btn-primary">Contact Us</Link>
                    </div>
                </div>
            </section>
        </>
    );
}
