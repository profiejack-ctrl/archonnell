import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw } from 'lucide-react';
import Icon from './Icon';

/*
 * Shared table filtering + sorting (every table of the HRMS uses these, so they
 * behave the same everywhere). Pages keep their own markup: they pass the rows
 * through useTableView() and swap plain <th> cells for <SortTh>; filter
 * controls go in the page's existing .toolbar-left.
 */

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }
export type SortValue = string | number | boolean | null | undefined;

/** Dates / datetimes from the database ("2026-10-01" or "2026-10-01 08:30:00"). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/;

function compareValues(a: SortValue, b: SortValue): number {
    const empty = (v: SortValue) => v === null || v === undefined || v === '';
    if (empty(a) && empty(b)) return 0;
    if (empty(a)) return 1; // empty values last, whichever direction
    if (empty(b)) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b);
    const x = String(a);
    const y = String(b);
    if (ISO_DATE.test(x) && ISO_DATE.test(y)) return x < y ? -1 : x > y ? 1 : 0;
    const nx = Number(x);
    const ny = Number(y);
    if (x.trim() !== '' && y.trim() !== '' && Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
}

export interface TableView<T> {
    /** The rows after the filter and the sort. */
    rows: T[];
    sort: SortState | null;
    /** Sort by a column: first click ascending, next click descending, and so on. */
    sortBy: (key: string) => void;
    /** Total rows before filtering (for "x of y" and the empty message). */
    total: number;
}

/**
 * Filter + sort one table's rows. `sorters` maps a column key to the value it
 * sorts by (text, number, ISO date or a rank for statuses).
 */
/** Sort state alone (tables sorted by the server, e.g. Audit Logs); same click behaviour as useTableView. */
export function useSort(initial: SortState | null = null): Pick<TableView<unknown>, 'sort' | 'sortBy'> {
    const [sort, setSort] = useState<SortState | null>(initial);
    const sortBy = useCallback((key: string) => {
        setSort(s => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    }, []);
    return { sort, sortBy };
}

export function useTableView<T>(rows: T[] | null | undefined, filter: (row: T) => boolean,
    sorters: Record<string, (row: T) => SortValue>, initial: SortState | null = null): TableView<T> {
    const { sort, sortBy } = useSort(initial);
    const list = rows ?? [];
    const out = useMemo(() => {
        const kept = list.filter(filter);
        const get = sort ? sorters[sort.key] : undefined;
        if (!sort || !get) return kept;
        const sign = sort.dir === 'asc' ? 1 : -1;
        return kept
            .map((row, i) => ({ row, i, v: get(row) }))
            .sort((p, q) => {
                const c = compareValues(p.v, q.v);
                const emptyP = p.v === null || p.v === undefined || p.v === '';
                const emptyQ = q.v === null || q.v === undefined || q.v === '';
                // Empty values stay last in both directions; ties keep the server order.
                return (emptyP || emptyQ ? c : c * sign) || p.i - q.i;
            })
            .map(x => x.row);
        // sorters / filter are rebuilt each render; the rows, the sort and the filter result are what matter.
    }, [list, sort, filter, sorters]); // eslint-disable-line react-hooks/exhaustive-deps
    return { rows: out, sort, sortBy, total: list.length };
}

/** A sortable column header: click to sort; the arrow shows the current direction. */
export function SortTh<T>({ view, k, children, className, style }: {
    view: Pick<TableView<T>, 'sort' | 'sortBy'>;
    k: string;
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    const active = view.sort?.key === k ? view.sort.dir : null;
    return (
        <th className={`th-sort${active ? ' th-sorted' : ''}${className ? ' ' + className : ''}`} style={style}
            aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}>
            <button type="button" className="th-sort-btn" onClick={() => view.sortBy(k)}
                title={active === 'asc' ? 'Sorted ascending - click to sort descending' : 'Click to sort'}>
                <span>{children}</span>
                <Icon as={active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown} className="th-sort-ind" />
            </button>
        </th>
    );
}

export interface FilterState<F> {
    values: F;
    set: (key: keyof F) => (value: string) => void;
    clear: () => void;
    /** True while any filter differs from its initial value. */
    active: boolean;
}

/**
 * "Sort by" control, for tables that sort by fields they do not show as columns
 * (it shares the state of the column headers, so both stay in step).
 */
export function SortSelect<T>({ view, id, options }: {
    view: Pick<TableView<T>, 'sort' | 'sortBy'>;
    id: string;
    options: { key: string; label: string }[];
}) {
    const current = view.sort && options.some(o => o.key === view.sort!.key) ? view.sort : null;
    return (
        <span className="sort-select">
            <select className="form-select" id={id} aria-label="Sort by" title="Sort by" value={current?.key ?? ''}
                onChange={e => { if (e.target.value && e.target.value !== current?.key) view.sortBy(e.target.value); }}>
                <option value="">Sort by...</option>
                {options.map(o => <option key={o.key} value={o.key}>Sort by: {o.label}</option>)}
            </select>
            {current && (
                <button type="button" className="btn btn-outline btn-sm" id={`${id}Dir`} title={current.dir === 'asc' ? 'Ascending - click for descending' : 'Descending - click for ascending'}
                    aria-label={current.dir === 'asc' ? 'Sort descending' : 'Sort ascending'} onClick={() => view.sortBy(current.key)}>
                    <Icon as={current.dir === 'asc' ? ArrowUp : ArrowDown} /> {current.dir === 'asc' ? 'Asc' : 'Desc'}
                </button>
            )}
        </span>
    );
}

/** Filter state of one table: values by key, a setter per key, and a reset. */
export function useFilters<F extends Record<string, string>>(initial: F): FilterState<F> {
    const [values, setValues] = useState<F>(initial);
    const set = useCallback((key: keyof F) => (value: string) => setValues(v => ({ ...v, [key]: value })), []);
    const clear = useCallback(() => setValues(initial), []); // eslint-disable-line react-hooks/exhaustive-deps
    const active = Object.keys(initial).some(k => values[k] !== initial[k]);
    return { values, set, clear, active };
}

/** Dropdown filter: "All ..." plus the given options. */
export function FilterSelect({ id, label, value, onChange, options, allLabel }: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: (string | { value: string; label: string })[];
    allLabel?: string;
}) {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    // A value no longer offered (e.g. after the data changed) still shows, so nothing is filtered silently.
    if (value && !opts.some(o => o.value === value)) opts.push({ value, label: value });
    return (
        <select className="form-select" id={id} aria-label={label} title={label} value={value} onChange={e => onChange(e.target.value)}>
            <option value="">{allLabel ?? `All ${label}`}</option>
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

/** From / To date filter. */
export function DateRangeFilter({ id, label, from, to, onFrom, onTo }: {
    id: string;
    label: string;
    from: string;
    to: string;
    onFrom: (v: string) => void;
    onTo: (v: string) => void;
}) {
    return (
        <div className="filter-date-range" role="group" aria-label={label} title={label}>
            <span className="filter-date-label">{label}</span>
            <input type="date" className="form-input" id={`${id}From`} aria-label={`${label} from`} value={from} max={to || undefined} onChange={e => onFrom(e.target.value)} />
            <span className="filter-date-sep">to</span>
            <input type="date" className="form-input" id={`${id}To`} aria-label={`${label} to`} value={to} min={from || undefined} onChange={e => onTo(e.target.value)} />
        </div>
    );
}

/** Reset every filter of the table (shown only while one is set). */
export function ClearFilters({ active, onClear, id }: { active: boolean; onClear: () => void; id?: string }) {
    if (!active) return null;
    return (
        <button type="button" className="btn btn-outline btn-sm filter-clear" id={id} onClick={onClear}>
            <Icon as={RotateCcw} /> Clear Filters
        </button>
    );
}

/** "Showing x of y" while filters hide records. */
export function FilterCount({ shown, total }: { shown: number; total: number }) {
    if (shown === total) return null;
    return <span className="filter-count">Showing {shown} of {total}</span>;
}

/** Distinct non-empty values of a column, sorted (dropdown options from the loaded records). */
export function distinct<T>(rows: T[] | null | undefined, get: (row: T) => string | null | undefined): string[] {
    const set = new Set<string>();
    for (const r of rows ?? []) {
        const v = (get(r) ?? '').trim();
        if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

/** True when the date part of `value` lies within from..to (either end optional; invalid input ignored). */
export function inDateRange(value: string | null | undefined, from: string, to: string): boolean {
    // A real calendar date only (2026-13-99 is ignored like an empty filter).
    const valid = (s: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
        const [y, m, d] = s.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
    };
    const okFrom = valid(from);
    const okTo = valid(to);
    if (!okFrom && !okTo) return true;
    const d = (value ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    return (!okFrom || d >= from) && (!okTo || d <= to);
}

/** Case-insensitive "contains" over several cells (search box). */
export function matchesText(query: string, ...cells: (string | number | null | undefined)[]): boolean {
    const q = query.trim().toLowerCase();
    return !q || cells.map(c => (c === null || c === undefined ? '' : String(c))).join(' ').toLowerCase().replace(/\s+/g, ' ').includes(q);
}

/** Equality filter: empty filter value matches everything. */
export function is(filterValue: string, value: string | null | undefined): boolean {
    return !filterValue || (value ?? '').trim().toLowerCase() === filterValue.trim().toLowerCase();
}
