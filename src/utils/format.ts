/**
 * Date / text formatting that reproduces the legacy output exactly
 * (PHP date() formats rendered server-side, and app.js' Intl formats).
 * Database values are Manila wall-clock strings "YYYY-MM-DD HH:MM:SS".
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Parse "YYYY-MM-DD[ HH:MM[:SS]]" as a local wall-clock Date (never as UTC). */
export function parseDbDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value));
    if (!m) {
        const d = new Date(String(value));
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

function time12(d: Date): string {
    const h = d.getHours() % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** PHP date('M j, Y') -> "Sep 24, 2026" */
export function phpMjY(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
}

/** PHP date('F j, Y') -> "September 24, 2026" */
export function phpFjY(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
}

/** PHP date('M j, Y g:i A') -> "Sep 24, 2026 5:30 PM" */
export function phpMjYgiA(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${phpMjY(value)} ${time12(d)}` : '';
}

/** PHP date('M j, Y · g:i A') -> interview schedule badge */
export function phpSchedule(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${phpMjY(value)} · ${time12(d)}` : '';
}

/** PHP date('M j, Y \a\t g:i A') -> dashboard announcement meta */
export function phpMjYatgiA(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${phpMjY(value)} at ${time12(d)}` : '';
}

/** PHP date('M j') */
export function phpMj(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '';
}

/** app.js annFormatDateTime: toLocaleString en-US short month, numeric day/year, h:mm */
export function annFormatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const d = parseDbDate(value);
    if (!d) return String(value);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** app.js fmtDateTimeShort: "Sep 24, 2026 at 5:30 PM" */
export function fmtDateTimeShort(value: string | null | undefined): string {
    if (!value) return '';
    const d = parseDbDate(value);
    if (!d) return String(value);
    const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${date} at ${time}`;
}

/** app.js fmtLongDate: "September 24, 2026" */
export function fmtLongDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = parseDbDate(value);
    if (!d) return String(value);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** "YYYY-MM-DD HH:MM:SS" -> value for <input type="datetime-local"> */
export function toDatetimeLocal(value: string | null | undefined): string {
    return value ? String(value).replace(' ', 'T').slice(0, 16) : '';
}

/** First 10 chars (the date part) of a DB timestamp. */
export function datePart(value: string | null | undefined): string {
    return value ? String(value).substring(0, 10) : '';
}

/** Local calendar date `days` from today as "YYYY-MM-DD" (min/max of <input type="date">). */
export function isoDateFromToday(days = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Header clock: Intl en-US, e.g. "Thu, Sep 24, 2026, 05:30:12 PM" */
export function headerDateTime(d: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d);
}

/** PHP mb_strimwidth($s, 0, $width, '…') */
export function strimwidth(value: string | null | undefined, width: number): string {
    const s = String(value ?? '');
    const chars = Array.from(s);
    if (chars.length <= width) return s;
    return chars.slice(0, width - 1).join('') + '…';
}

/** Dashboard announcement excerpt (summary or body, tags stripped, 240 chars). */
export function announceExcerpt(a: { summary?: string | null; body?: string | null }): string {
    const raw = String(a.summary || a.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return raw.length > 240 ? raw.slice(0, 240).trimEnd() + '…' : raw;
}

/** Applicant ID shown in tables: applicant_no, else APP-### from the row id. */
export function applicantNo(a: { applicant_no?: string | null; id: number }): string {
    return a.applicant_no || `APP-${String(a.id).padStart(3, '0')}`;
}

/** Short chart-axis label for a department name: initials if multi-word, else truncated. */
export function deptAbbrev(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) {
        return words.map(w => Array.from(w)[0]).join('').toUpperCase().slice(0, 4);
    }
    const chars = Array.from(name);
    return chars.length <= 6 ? name : chars.slice(0, 5).join('') + '.';
}

/** Up to two initials, e.g. "Adrian Mendoza" -> "AM" */
export function initials(first: string | null | undefined, last: string | null | undefined): string {
    return ((first || '').charAt(0) + (last || '').charAt(0)).toUpperCase();
}

/** Number with thousands separators, like PHP number_format / toLocaleString */
export function num(n: number | string | null | undefined): string {
    return Number(n ?? 0).toLocaleString('en-US');
}
