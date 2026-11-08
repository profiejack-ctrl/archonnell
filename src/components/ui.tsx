/**
 * Small presentational building blocks that reproduce the legacy markup
 * one-to-one (same class names, so styles.css renders them identically).
 */
import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, User, type LucideIcon } from 'lucide-react';
import Icon from './Icon';

/** Page title block (".page-header"). */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="page-header">
            {subtitle !== undefined ? (
                <div>
                    <h1 className="page-title-lg">{title}</h1>
                    <p className="page-subtitle">{subtitle}</p>
                </div>
            ) : (
                <h1 className="page-title-lg">{title}</h1>
            )}
        </div>
    );
}

/** A routed page (".page.active" plays the existing fade-in). */
export function Page({ id, children }: { id: string; children: ReactNode }) {
    return <div className="page active" id={`page-${id}`}>{children}</div>;
}

/** Stat card with the gradient icon tile. */
export function StatCard({ icon, gradient, value, label, trend }: {
    icon: LucideIcon;
    gradient: [string, string];
    value: ReactNode;
    label: string;
    trend?: number;
}) {
    return (
        <div className="stat-card hover-card">
            <div className="stat-icon" style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}>
                <Icon as={icon} />
            </div>
            <div className="stat-info">
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
            </div>
            {trend !== undefined && (
                <div className={`stat-change ${trend >= 0 ? 'positive' : 'negative'}`} title={`${trend >= 0 ? '+' : ''}${trend}% vs last month`}>
                    <Icon as={trend >= 0 ? ArrowUp : ArrowDown} /> {Math.abs(trend)}%
                </div>
            )}
        </div>
    );
}

export function StatsGrid({ children }: { children: ReactNode }) {
    return <div className="stats-grid">{children}</div>;
}

/** Card with optional header (title/subtitle/actions). */
export function Card({ title, subtitle, actions, children, bodyClass, className, style, id, bodyStyle }: {
    title?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    bodyClass?: string;
    className?: string;
    style?: CSSProperties;
    bodyStyle?: CSSProperties;
    id?: string;
}) {
    return (
        <div className={`card hover-card${className ? ' ' + className : ''}`} style={style} id={id}>
            {(title || actions) && (
                <div className="card-header">
                    {subtitle !== undefined ? (
                        <div>
                            <h3 className="card-title">{title}</h3>
                            <p className="card-subtitle">{subtitle}</p>
                        </div>
                    ) : (
                        <h3 className="card-title">{title}</h3>
                    )}
                    {actions}
                </div>
            )}
            <div className={`card-body${bodyClass ? ' ' + bodyClass : ''}`} style={bodyStyle}>{children}</div>
        </div>
    );
}

/** Toolbar search input (".search-box"). */
export function SearchBox({ value, onChange, placeholder, id }: { value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
    return (
        <div className="search-box">
            <Icon as={Search} />
            <input type="text" id={id} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
        </div>
    );
}

/** Status badge (".badge .badge-*"). */
export function Badge({ variant, children, style }: { variant: string; children: ReactNode; style?: CSSProperties }) {
    return <span className={`badge ${variant}`} style={style}>{children}</span>;
}

/** Five-colour avatar palette cycled per table row, as in the legacy tables. */
export const ROW_PALETTE: [string, string][] = [['#dbeafe', '#2563eb'], ['#d1fae5', '#10b981'], ['#fef3c7', '#f59e0b'], ['#ede9fe', '#8b5cf6'], ['#fce7f3', '#ec4899']];

/** Avatar + name cell used by most tables. */
export function PersonCell({ index, name }: { index: number; name: ReactNode }) {
    const c = ROW_PALETTE[index % ROW_PALETTE.length];
    return (
        <div className="table-cell-flex">
            <div className="cell-avatar" style={{ background: c[0] }}>
                <Icon as={User} style={{ color: c[1] }} />
            </div>
            <span>{name}</span>
        </div>
    );
}

/** Full-width "no rows" table message. */
export function EmptyRow({ colSpan, children, className, style }: { colSpan: number; children: ReactNode; className?: string; style?: CSSProperties }) {
    return (
        <tr className={className}>
            <td colSpan={colSpan} className="empty-row-cell" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', ...style }}>
                <div className="empty-row-text">{children}</div>
            </td>
        </tr>
    );
}

/** Label/value tile used in modals (".info-item"). */
export function InfoItem({ label, children, full, labelTag = 'div', style }: {
    label: string;
    children: ReactNode;
    full?: boolean;
    labelTag?: 'div' | 'label';
    style?: CSSProperties;
}) {
    return (
        <div className={`info-item${full ? ' full-width' : ''}`} style={style}>
            {labelTag === 'label' ? <label>{label}</label> : <div className="info-label">{label}</div>}
            <div className="info-value">{children}</div>
        </div>
    );
}

/** Loading / error placeholder while a page's data is fetched. */
export function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
    if (loading) {
        return (
            <div className="chart-state-box" style={{ minHeight: 160 }}>
                <div className="chart-spinner"></div>
                <div className="chart-state-title">Loading…</div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="chart-state-box" style={{ minHeight: 160 }}>
                <div className="chart-state-title">Could not load this page</div>
                <div className="chart-state-msg">{error}</div>
                <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: '0.5rem' }} onClick={onRetry}>Retry</button>
            </div>
        );
    }
    return null;
}
