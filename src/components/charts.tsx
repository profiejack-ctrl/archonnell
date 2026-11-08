/**
 * Charts, ported 1:1 from the legacy markup/JS (no chart library):
 *  - BarColumns: the CSS ".chart-bars" columns that grow in after load
 *  - Donut + Legend: CSS conic-gradient donut
 *  - AnimatedProgress: ".progress-fill" bars that slide in
 *  - DepartmentBarChart / HiresLineChart: the onboarding SVG charts with tooltips
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BarChart3, LineChart } from 'lucide-react';
import Icon from './Icon';
import type { DepartmentHires, HiresOverTime } from '../types';

/** Grow from 0 to the target value after `delay` ms (the legacy staggered animation). */
function useDelayedValue(target: number, delay: number): number {
    const [value, setValue] = useState(0);
    useEffect(() => {
        const t = window.setTimeout(() => setValue(target), delay);
        return () => window.clearTimeout(t);
    }, [target, delay]);
    return value;
}

export const TREND_GRADIENTS: [string, string][] = [
    ['#60a5fa', '#2563eb'], ['#34d399', '#10b981'], ['#fbbf24', '#f59e0b'],
    ['#a78bfa', '#8b5cf6'], ['#f472b6', '#ec4899'], ['#22d3ee', '#06b6d4'],
];

function BarColumn({ index, value, heightPct, label, labelTitle }: { index: number; value: number; heightPct: number; label: string; labelTitle?: string }) {
    const g = TREND_GRADIENTS[index % TREND_GRADIENTS.length];
    const h = useDelayedValue(heightPct, 150 + index * 100);
    return (
        <div className="chart-bar">
            <div className="chart-bar-value">{value}</div>
            <div className="chart-bar-fill" style={{ height: `${h}%`, background: `linear-gradient(180deg, ${g[0]}, ${g[1]})` }}></div>
            <span className="chart-label" title={labelTitle}>{label}</span>
        </div>
    );
}

export function BarColumns({ id, items, max }: { id?: string; items: { label: string; value: number; title?: string }[]; max: number }) {
    return (
        <div className="chart-container">
            <div className="chart-bars" id={id}>
                {items.map((it, i) => (
                    <BarColumn key={i} index={i} value={it.value} heightPct={max > 0 ? Math.round((it.value / max) * 100) : 0} label={it.label} labelTitle={it.title} />
                ))}
            </div>
        </div>
    );
}

/** CSS conic-gradient() from [{pct, color}]. */
export function donutGradient(segments: { pct: number; color: string }[]): string {
    let deg = 0;
    const stops = segments.map(s => {
        const next = deg + (Number(s.pct) / 100) * 360;
        const stop = `${s.color} ${deg.toFixed(2)}deg ${next.toFixed(2)}deg`;
        deg = next;
        return stop;
    });
    return stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e5e7eb 0deg 360deg)';
}

export function Donut({ id, segments, value, label, totalId, withSegment }: {
    id?: string;
    segments: { pct: number; color: string }[];
    value: number;
    label: string;
    totalId?: string;
    withSegment?: boolean;
}) {
    return (
        <div className="donut-chart" id={id} style={{ background: donutGradient(segments) }}>
            {withSegment && <div className="donut-segment"></div>}
            <div className="donut-center">
                <div className="donut-center-value" id={totalId}>{value}</div>
                <div className="donut-center-label">{label}</div>
            </div>
        </div>
    );
}

export function Legend({ id, items }: { id?: string; items: { name: string; pct: number; count: number; color: string }[] }) {
    return (
        <div className="chart-legend" id={id}>
            {items.map(it => (
                <div className="legend-item hover-item" key={it.name}>
                    <span className="legend-dot" style={{ background: it.color }}></span>
                    <span className="legend-label">{it.name} {it.pct}%</span>
                    <span className="legend-count">{it.count}</span>
                </div>
            ))}
        </div>
    );
}

export function AnimatedProgress({ index, pct }: { index: number; pct: number }) {
    const w = useDelayedValue(pct, 300 + index * 150);
    return (
        <div className="progress-container">
            <div className="progress-bar">
                <div className="progress-fill animated-progress" style={{ width: `${w}%` }}></div>
            </div>
            <span className="progress-text">{pct}%</span>
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Onboarding SVG charts
 * ------------------------------------------------------------------ */
interface TooltipState { left: number; top: number; title: string; count: number }

function ChartShell({ children, tooltip }: { children: ReactNode; tooltip: TooltipState | null }) {
    return (
        <>
            {children}
            <div className={`chart-tooltip${tooltip ? ' is-active' : ''}`} style={tooltip ? { left: tooltip.left, top: tooltip.top } : undefined}>
                {tooltip && (
                    <>
                        <div className="chart-tooltip-title">{tooltip.title}</div>
                        <div className="chart-tooltip-value"><strong>{tooltip.count}</strong> new hire{tooltip.count === 1 ? '' : 's'}</div>
                    </>
                )}
            </div>
        </>
    );
}

function niceScale(maxVal: number): { step: number; niceMax: number } {
    const step = maxVal <= 4 ? 1 : (maxVal <= 10 ? 2 : (maxVal <= 25 ? 5 : 10));
    return { step, niceMax: Math.ceil(maxVal / step) * step };
}

function useTooltip(wrapper: React.RefObject<HTMLDivElement | null>) {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const show = (el: Element, title: string, count: number) => {
        const container = wrapper.current;
        if (!container) return;
        const rect = el.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        setTooltip({ left: rect.left - cRect.left + rect.width / 2, top: rect.top - cRect.top, title, count });
    };
    return { tooltip, show, hide: () => setTooltip(null) };
}

const SVG_W = 540;
const SVG_H = 260;

export function DepartmentBarChart({ items, wrapperRef }: { items: DepartmentHires[]; wrapperRef: React.RefObject<HTMLDivElement | null> }) {
    const uid = useId().replace(/:/g, '');
    const { tooltip, show, hide } = useTooltip(wrapperRef);
    if (!items.length) {
        return (
            <div className="chart-state-box">
                <Icon as={BarChart3} className="chart-state-icon" />
                <div className="chart-state-title">No New Hires Recorded</div>
                <div className="chart-state-msg">Newly hired employees will appear here grouped by department.</div>
            </div>
        );
    }
    const margin = { top: 34, right: 25, bottom: 50, left: 45 };
    const plotW = SVG_W - margin.left - margin.right;
    const plotH = SVG_H - margin.top - margin.bottom;
    const { step, niceMax } = niceScale(Math.max(1, ...items.map(d => Number(d.count) || 0)));
    const ticks: number[] = [];
    for (let t = 0; t <= niceMax; t += step) ticks.push(t);
    const slotW = plotW / items.length;
    const barW = Math.min(46, Math.max(22, slotW * 0.6));

    return (
        <ChartShell tooltip={tooltip}>
            <svg className="chart-svg" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    {items.map((item, i) => (
                        <linearGradient key={i} id={`deptGrad_${uid}_${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={item.color || '#2563eb'} stopOpacity="1" />
                            <stop offset="100%" stopColor={item.color || '#2563eb'} stopOpacity="0.75" />
                        </linearGradient>
                    ))}
                </defs>
                {ticks.map(t => {
                    const y = margin.top + plotH - (t / niceMax) * plotH;
                    return (
                        <g key={t}>
                            <line className="chart-grid-line" x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} />
                            <text className="chart-tick-label" x={margin.left - 10} y={y + 4} textAnchor="end">{t}</text>
                        </g>
                    );
                })}
                <line className="chart-axis-line" x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} />
                <text className="chart-axis-title" x={margin.left} y={margin.top - 14}>Number of New Hires</text>
                {items.map((item, i) => {
                    const count = Number(item.count) || 0;
                    const barH = niceMax > 0 ? (count / niceMax) * plotH : 0;
                    const barX = margin.left + i * slotW + (slotW - barW) / 2;
                    const barY = margin.top + plotH - barH;
                    const fullDept = item.department || 'Unassigned';
                    const shortDept = fullDept.length > 11 ? fullDept.substring(0, 10) + '…' : fullDept;
                    return (
                        <g key={i}>
                            {barH > 0 ? (
                                <rect className="chart-bar-rect" x={barX} y={barY} width={barW} height={barH} rx="4" ry="4"
                                    fill={`url(#deptGrad_${uid}_${i})`} tabIndex={0} role="graphics-symbol" aria-label={`${fullDept}: ${count} new hires`}
                                    onMouseEnter={e => show(e.currentTarget, fullDept, count)} onFocus={e => show(e.currentTarget, fullDept, count)}
                                    onMouseLeave={hide} onBlur={hide} />
                            ) : (
                                <rect className="chart-bar-rect" x={barX} y={margin.top + plotH - 2} width={barW} height="2" rx="1" ry="1"
                                    fill={item.color || '#2563eb'} opacity="0.3"
                                    onMouseEnter={e => show(e.currentTarget, fullDept, 0)} onMouseLeave={hide} />
                            )}
                            {count > 0 && <text className="chart-bar-badge" x={barX + barW / 2} y={barY - 6}>{count}</text>}
                            <text className="chart-tick-label" x={barX + barW / 2} y={margin.top + plotH + 18} textAnchor="middle">
                                <title>{fullDept}</title>{shortDept}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </ChartShell>
    );
}

export function HiresLineChart({ items, wrapperRef }: { items: HiresOverTime[]; wrapperRef: React.RefObject<HTMLDivElement | null> }) {
    const uid = useId().replace(/:/g, '');
    const { tooltip, show, hide } = useTooltip(wrapperRef);
    if (!items.length) {
        return (
            <div className="chart-state-box">
                <Icon as={LineChart} className="chart-state-icon" />
                <div className="chart-state-title">No Timeline Data Yet</div>
                <div className="chart-state-msg">Monthly hiring trend will appear here as employees are hired.</div>
            </div>
        );
    }
    const margin = { top: 34, right: 30, bottom: 50, left: 45 };
    const plotW = SVG_W - margin.left - margin.right;
    const plotH = SVG_H - margin.top - margin.bottom;
    const { step, niceMax } = niceScale(Math.max(1, ...items.map(d => Number(d.count) || 0)));
    const ticks: number[] = [];
    for (let t = 0; t <= niceMax; t += step) ticks.push(t);
    const n = items.length;
    const points = items.map((item, i) => ({
        x: margin.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
        y: margin.top + plotH - (niceMax > 0 ? (Number(item.count) / niceMax) * plotH : 0),
        item,
    }));

    let lineD: string;
    let areaD: string;
    if (points.length === 1) {
        const p = points[0];
        lineD = `M ${margin.left} ${p.y} L ${margin.left + plotW} ${p.y}`;
        areaD = `M ${margin.left} ${p.y} L ${margin.left + plotW} ${p.y} L ${margin.left + plotW} ${margin.top + plotH} L ${margin.left} ${margin.top + plotH} Z`;
    } else {
        lineD = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cpX = (p0.x + p1.x) / 2;
            lineD += ` C ${cpX.toFixed(2)} ${p0.y.toFixed(2)}, ${cpX.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
        }
        areaD = `${lineD} L ${points[points.length - 1].x.toFixed(2)} ${(margin.top + plotH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(margin.top + plotH).toFixed(2)} Z`;
    }
    const gradId = `lineAreaGrad_${uid}`;

    return (
        <ChartShell tooltip={tooltip}>
            <svg className="chart-svg" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                        <stop offset="65%" stopColor="#2563eb" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                </defs>
                {ticks.map(t => {
                    const y = margin.top + plotH - (t / niceMax) * plotH;
                    return (
                        <g key={t}>
                            <line className="chart-grid-line" x1={margin.left} y1={y} x2={margin.left + plotW} y2={y} />
                            <text className="chart-tick-label" x={margin.left - 10} y={y + 4} textAnchor="end">{t}</text>
                        </g>
                    );
                })}
                <line className="chart-axis-line" x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} />
                <text className="chart-axis-title" x={margin.left} y={margin.top - 14}>Number of New Hires</text>
                <path className="chart-area-fill" d={areaD} fill={`url(#${gradId})`} />
                <path className="chart-line-path" d={lineD} />
                {points.map((p, i) => {
                    const count = Number(p.item.count) || 0;
                    const fullMonth = p.item.label || p.item.year_month;
                    return (
                        <g key={i}>
                            <circle className="chart-point" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="5" tabIndex={0} role="graphics-symbol"
                                aria-label={`${fullMonth}: ${count} new hires`}
                                onMouseEnter={e => show(e.currentTarget, fullMonth, count)} onFocus={e => show(e.currentTarget, fullMonth, count)}
                                onMouseLeave={hide} onBlur={hide} />
                            <text className="chart-tick-label" x={p.x.toFixed(2)} y={margin.top + plotH + 20} textAnchor="middle">
                                {p.item.short_label || p.item.year_month}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </ChartShell>
    );
}

/** The ".chart-svg-wrapper" container both onboarding charts render into. */
export function ChartWrapper({ id, type, label, children }: {
    id: string;
    type: 'bar' | 'line';
    label: string;
    children: (ref: React.RefObject<HTMLDivElement | null>) => ReactNode;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    return (
        <div className="chart-svg-wrapper" id={id} data-chart-type={type} aria-label={label} ref={ref}>
            {children(ref)}
        </div>
    );
}
