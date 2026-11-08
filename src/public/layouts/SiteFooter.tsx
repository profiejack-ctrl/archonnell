import { Link } from 'react-router-dom';
import logo from '../../../../Homepage/assets/img/LOGO.png';

/** Site footer (includes/public_footer.php; variant="applicant" = includes/footer.php). */
export default function SiteFooter({ variant }: { variant: 'public' | 'applicant' }) {
    const isApplicant = variant === 'applicant';
    const year = new Date().getFullYear();

    return (
        <>
            <footer className={isApplicant ? 'footer applicant-footer' : 'footer'}>
                <div className="container footer-grid">
                    <div className="footer-brand">
                        <Link to="/" className="logo">
                            <img
                                src={logo}
                                alt="Archon Nell Incorporated Logo"
                                className={isApplicant ? undefined : 'footer-logo'}
                                style={{ height: 60, width: 'auto', maxWidth: '100%' }}
                            />
                        </Link>
                        <p>
                            We don't just supply construction chemicals —
                            we engineer formulations that protect,
                            strengthen, and extend the lifespan of your
                            structures.
                        </p>
                    </div>

                    <div className="footer-column">
                        <h3>Office Address</h3>
                        <p>
                            Head Office and Plant<br />
                            Plant 2,#1024 industrial Park,<br />
                            Felix Ave. Brgy, Sto Domingo Cainta,<br />
                            1900 Rizal Metro Manila, Philippines<br />
                        </p>
                    </div>

                    <div className="footer-column">
                        <h3>Working Hours</h3>
                        <p>
                            Visit us at our Head Office for free
                            consultation over a cup of coffee.
                        </p>
                        <p>
                            Monday - Friday<br />
                            9:00 AM - 6:00 PM
                        </p>
                    </div>

                    {isApplicant ? (
                        <div className="footer-column">
                            <h3>Latest News</h3>
                            <Link to="/projects">New Industrial Project</Link>
                            <Link to="/products">New Product Solutions</Link>
                            <Link to="/contact">Contact Our Team</Link>
                        </div>
                    ) : (
                        <div className="footer-column">
                            <h3>Quick Links</h3>
                            <Link to="/projects">New Industrial Project</Link>
                            <Link to="/products">New Product Solutions</Link>
                            <Link to="/apply">Careers / Apply Now</Link>
                            <Link to="/contact">Contact Our Team</Link>
                        </div>
                    )}
                </div>

                <div className="container">
                    <div className="copyright">
                        © <span>{year}</span> Archon Nell Incorporated. All Rights Reserved.
                    </div>
                </div>
            </footer>

            <div className="toast" id="toast"></div>
        </>
    );
}
