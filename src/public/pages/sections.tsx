import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Blue page banner at the top of each company page. */
export function PageHero({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="page-hero">
            <div className="container">
                <div className="section-label"></div>
                <h1>{title}</h1>
                <p>{children}</p>
            </div>
        </section>
    );
}

const PROJECTS = [
    { cls: 'project-one', tag: 'INDUSTRIAL', title: 'Process Facility Development' },
    { cls: 'project-two', tag: 'INFRASTRUCTURE', title: 'Structural Protection' },
    { cls: 'project-three', tag: 'ENGINEERING', title: 'Plant Maintenance' },
];

/** "Selected Projects" (home page and Projects page). */
export function ProjectsSection() {
    return (
        <section className="projects">
            <div className="container">
                <div className="center-heading reveal">
                    <div className="section-label">OUR WORK</div>
                    <h2 className="section-title">Selected Projects</h2>
                    <p className="section-description">
                        A selection of industrial environments and
                        applications where our expertise makes a
                        difference.
                    </p>
                </div>

                <div className="project-grid">
                    {PROJECTS.map(p => (
                        <article key={p.cls} className={`project ${p.cls} reveal`}>
                            <div className="project-content">
                                <small>{p.tag}</small>
                                <h3>{p.title}</h3>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="center-button">
                    <Link to="/projects" className="btn btn-primary">View All Projects</Link>
                </div>
            </div>
        </section>
    );
}

const PRODUCTS = [
    { n: '01', title: 'Protective Coatings', text: 'Advanced protective systems for industrial structures.' },
    { n: '02', title: 'Construction Chemicals', text: 'Formulations designed for demanding construction applications.' },
    { n: '03', title: 'Industrial Adhesives', text: 'High-performance bonding and repair solutions.' },
    { n: '04', title: 'Specialty Formulations', text: 'Custom chemical solutions engineered around your requirements.' },
];

/** "Built for Performance" (home page and Products page). */
export function ProductsSection() {
    return (
        <section className="products">
            <div className="container">
                <div className="center-heading reveal">
                    <div className="section-label">OUR PRODUCTS</div>
                    <h2 className="section-title">Built for Performance</h2>
                </div>

                <div className="product-grid">
                    {PRODUCTS.map(p => (
                        <article key={p.n} className="product reveal">
                            <div className="product-number">{p.n}</div>
                            <h3>{p.title}</h3>
                            <p>{p.text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

const PARTNERS = ['INDUSTRIAL GROUP', 'ENGINEERING PARTNERS', 'CONSTRUCTION NETWORK', 'TECHNOLOGY PARTNERS', 'SUPPLY PARTNERS'];

/** "Trusted by Industry Partners" (home page and Partners page). */
export function PartnersSection() {
    return (
        <section className="partners">
            <div className="container">
                <div className="section-label">OUR NETWORK</div>
                <h2>Trusted by Industry Partners</h2>
                <div className="partner-list">
                    {PARTNERS.map(name => <div key={name} className="partner">{name}</div>)}
                </div>
            </div>
        </section>
    );
}
