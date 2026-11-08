import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortal } from '../PortalContext';

const TOTAL_SLIDES = 2;
const AUTO_DELAY = 6000;

/**
 * Home page hero slider (js/main.js initHeroSlider): the company slide and
 * the "We Are HIRING" careers slide. Auto-advances every 6 s, pauses on hover,
 * and supports dots, arrows, swipe and the keyboard arrow keys.
 */
export default function HeroSlider() {
    const { careers } = usePortal();
    const [current, setCurrent] = useState(0);
    const timer = useRef<number | null>(null);
    const touchStartX = useRef(0);

    const goTo = useCallback((index: number) => {
        setCurrent(((index % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES);
    }, []);

    const stopAuto = useCallback(() => {
        if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    const startAuto = useCallback(() => {
        stopAuto();
        timer.current = window.setInterval(() => setCurrent(c => (c + 1) % TOTAL_SLIDES), AUTO_DELAY);
    }, [stopAuto]);

    const step = useCallback((delta: number) => {
        setCurrent(c => (((c + delta) % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES);
        startAuto();
    }, [startAuto]);

    useEffect(() => {
        startAuto();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') step(-1);
            else if (e.key === 'ArrowRight') step(1);
        };
        document.addEventListener('keydown', onKey);
        return () => { stopAuto(); document.removeEventListener('keydown', onKey); };
    }, [startAuto, stopAuto, step]);

    const slideClass = (i: number, extra = '') => ['hero-slide', extra, current === i ? 'active' : ''].filter(Boolean).join(' ');

    return (
        <section
            className="hero-slider"
            id="heroSlider"
            onMouseEnter={stopAuto}
            onMouseLeave={startAuto}
            onTouchStart={e => { stopAuto(); touchStartX.current = e.changedTouches[0].screenX; }}
            onTouchEnd={e => {
                const diff = e.changedTouches[0].screenX - touchStartX.current;
                if (Math.abs(diff) > 50) setCurrent(c => (((c + (diff < 0 ? 1 : -1)) % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES);
                startAuto();
            }}
        >
            <div className={slideClass(0)} data-slide="1">
                <div className="hero-overlay"></div>
                <div className="container hero-content">
                    <div className="hero-text">
                        <div className="hero-eyebrow">ENGINEERING • CONSTRUCTION • CHEMICALS</div>
                        <h1>
                            Building the<br />
                            future of industry.
                        </h1>
                        <p>
                            We engineer reliable solutions that protect,
                            strengthen, and extend the lifespan of your
                            infrastructure.
                        </p>
                        <div className="hero-buttons">
                            <Link to="/about" className="btn btn-primary">Discover More</Link>
                            <Link to="/contact" className="btn btn-outline">Contact Us</Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className={slideClass(1, 'hero-slide-careers')} data-slide="2">
                <div className="careers-bg"></div>
                <div className="careers-overlay"></div>

                <div className="careers-shape shape-top-left"></div>
                <div className="careers-shape shape-top-right"></div>
                <div className="careers-shape shape-bottom-right"></div>
                <div className="careers-shape shape-bottom-left"></div>

                <div className="container hero-content">
                    <div className="hero-text careers-text">
                        <div className="careers-heading">
                            <span className="careers-we-are">We Are</span>
                            <span className="careers-hiring-wrap">
                                <span className="careers-hiring-bar"></span>
                                <span className="careers-hiring">HIRING</span>
                            </span>
                        </div>

                        <div className="careers-subheading">
                            <h3>Looking for:</h3>
                        </div>

                        {/* Published job postings (Recruitment Management > Job Posting): each title opens its job page. */}
                        <ul className="careers-positions">
                            {careers.slice(0, 5).map(c => (
                                <li key={c.posting_no}>
                                    <Link to={`/careers/${c.posting_no}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.title}</Link>
                                </li>
                            ))}
                            {careers.length > 5 && (
                                <li><Link to="/careers" style={{ color: 'inherit' }}>and {careers.length - 5} more…</Link></li>
                            )}
                        </ul>

                        <div className="hero-buttons careers-buttons">
                            <Link to="/careers" className="btn btn-primary btn-apply">▼ Apply Now</Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="slider-nav">
                {[0, 1].map(i => (
                    <button
                        key={i}
                        className={current === i ? 'slider-dot active' : 'slider-dot'}
                        data-slide-target={i + 1}
                        aria-label={`Slide ${i + 1}`}
                        onClick={() => { goTo(i); startAuto(); }}
                    ></button>
                ))}
            </div>

            <button className="slider-arrow slider-arrow-prev" id="sliderPrev" aria-label="Previous slide" onClick={() => step(-1)}>‹</button>
            <button className="slider-arrow slider-arrow-next" id="sliderNext" aria-label="Next slide" onClick={() => step(1)}>›</button>
        </section>
    );
}
