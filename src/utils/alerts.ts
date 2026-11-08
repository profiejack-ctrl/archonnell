/**
 * ArchonAlert - the single alert / confirmation interface, built on SweetAlert2.
 * Same API, theme (css/archon-alerts.css), button order and wording as the
 * legacy js/archon-alerts.js, so every message looks and behaves as before.
 *
 *   ArchonAlert.success(message [, {title, timer, html, confirmText}])
 *   ArchonAlert.error / warning / info (same signature)
 *   ArchonAlert.confirm({title, text|html, confirmText, cancelText, icon, danger}) -> Promise<boolean>
 */
import Swal, { type SweetAlertIcon, type SweetAlertResult } from 'sweetalert2';

const TITLES: Record<string, string> = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Information', question: 'Confirm' };

export interface AlertOptions {
    title?: string;
    timer?: number;
    html?: string;
    confirmText?: string;
}

export interface ConfirmOptions {
    title?: string;
    text?: string;
    html?: string;
    confirmText?: string;
    cancelText?: string;
    icon?: SweetAlertIcon;
    danger?: boolean;
}

const themed = Swal.mixin({
    buttonsStyling: false,
    reverseButtons: true,
    heightAuto: false,
    returnFocus: false,
    customClass: {
        popup: 'archon-swal',
        confirmButton: 'archon-swal-btn archon-swal-btn--primary',
        cancelButton: 'archon-swal-btn archon-swal-btn--secondary',
    },
});

function fire(icon: SweetAlertIcon, message: string, opts: AlertOptions = {}): Promise<SweetAlertResult> {
    return themed.fire({
        icon,
        title: opts.title || TITLES[icon] || '',
        confirmButtonText: opts.confirmText || 'OK',
        ...(opts.html ? { html: opts.html } : { text: String(message ?? '') }),
        ...(opts.timer ? { timer: opts.timer, timerProgressBar: true } : {}),
    });
}

function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
    return themed.fire({
        icon: opts.icon || 'question',
        title: opts.title || 'Are you sure?',
        showCancelButton: true,
        confirmButtonText: opts.confirmText || 'Confirm',
        cancelButtonText: opts.cancelText || 'Cancel',
        focusCancel: !!opts.danger,
        // a per-call customClass replaces the mixin's, so restate the full theme here
        customClass: {
            popup: 'archon-swal',
            confirmButton: 'archon-swal-btn ' + (opts.danger ? 'archon-swal-btn--danger' : 'archon-swal-btn--primary'),
            cancelButton: 'archon-swal-btn archon-swal-btn--secondary',
        },
        ...(opts.html ? { html: opts.html } : opts.text ? { text: opts.text } : {}),
    }).then(result => !!result.isConfirmed);
}

/**
 * Confirmation that asks for a required text (e.g. a reason). `validate`
 * returns the message to show under the field, or '' when the text is fine;
 * resolves to the text, or null when cancelled.
 */
export function promptText(spec: {
    title: string;
    html: string;
    label: string;
    placeholder: string;
    confirmText: string;
    icon?: SweetAlertIcon;
    danger?: boolean;
    maxLength?: number;
    validate: (value: string) => string;
}): Promise<string | null> {
    return themed.fire({
        icon: spec.icon || 'warning',
        title: spec.title,
        html: spec.html,
        input: 'textarea',
        inputLabel: spec.label,
        inputPlaceholder: spec.placeholder,
        inputAttributes: { maxlength: String(spec.maxLength ?? 500), 'aria-label': spec.label },
        showCancelButton: true,
        confirmButtonText: spec.confirmText,
        cancelButtonText: 'Cancel',
        customClass: {
            popup: 'archon-swal',
            confirmButton: 'archon-swal-btn ' + (spec.danger ? 'archon-swal-btn--danger' : 'archon-swal-btn--primary'),
            cancelButton: 'archon-swal-btn archon-swal-btn--secondary',
        },
        inputValidator: value => spec.validate(String(value ?? '')) || null,
    }).then(result => (result.isConfirmed ? String(result.value ?? '') : null));
}

/** Escape text for the few alerts that are built as HTML (confirm details, account created). */
export function esc(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch] as string));
}

/**
 * The legacy confirm-only modals (archive / publish / delete / withdraw) were
 * shown as SweetAlert2 confirmations built from the modal's title, paragraphs
 * and "label / value" detail rows. Same layout here.
 */
export function confirmDialog(spec: {
    title: string;
    paragraphs: string[];
    details?: { label: string; value: string }[];
    icon: SweetAlertIcon;
    confirmText: string;
    danger?: boolean;
}): Promise<boolean> {
    let html = '';
    spec.paragraphs.forEach((p, i) => {
        html += `<p>${esc(p)}</p>`;
        if (i === 0 && spec.details) {
            spec.details.forEach(d => {
                html += `<div class="archon-swal-detail"><span>${esc(d.label)}</span><strong>${esc(d.value)}</strong></div>`;
            });
        }
    });
    return confirm({ title: spec.title, html, icon: spec.icon, confirmText: spec.confirmText, danger: spec.danger });
}

export const ArchonAlert = {
    success: (m: string, o?: AlertOptions) => fire('success', m, o),
    error: (m: string, o?: AlertOptions) => fire('error', m, o),
    warning: (m: string, o?: AlertOptions) => fire('warning', m, o),
    info: (m: string, o?: AlertOptions) => fire('info', m, o),
    confirm,
    isVisible: () => Swal.isVisible(),
    close: () => Swal.close(),
};

/**
 * A SweetAlert2 dialog holding a small form (html). `collect` reads the form
 * from the popup and returns the value, or a message to show under the form
 * when something is missing; resolves to the value, or null when cancelled.
 */
export function formDialog<T>(spec: {
    title: string;
    html: string;
    confirmText: string;
    icon?: SweetAlertIcon;
    danger?: boolean;
    width?: string;
    collect: (popup: HTMLElement) => T | string;
}): Promise<T | null> {
    return themed.fire({
        icon: spec.icon,
        title: spec.title,
        html: spec.html,
        width: spec.width ?? '40rem',
        showCancelButton: true,
        confirmButtonText: spec.confirmText,
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        customClass: {
            popup: 'archon-swal archon-swal-form',
            confirmButton: 'archon-swal-btn ' + (spec.danger ? 'archon-swal-btn--danger' : 'archon-swal-btn--primary'),
            cancelButton: 'archon-swal-btn archon-swal-btn--secondary',
        },
        preConfirm: () => {
            const popup = Swal.getPopup();
            if (!popup) return false;
            const r = spec.collect(popup);
            if (typeof r === 'string') {
                Swal.showValidationMessage(r);
                return false;
            }
            return r;
        },
    }).then(result => (result.isConfirmed ? (result.value as T) : null));
}
