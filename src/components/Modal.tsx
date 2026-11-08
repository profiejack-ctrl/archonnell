import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Icon from './Icon';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    /** Heading element of the title (the legacy markup used <h3> or <div>). */
    titleTag?: 'h3' | 'div';
    size?: 'md' | 'lg';
    footer?: ReactNode;
    children: ReactNode;
    zIndex?: number;
}

let openCount = 0;

/**
 * The system's modal (".modal-overlay" + ".modal"). It stays mounted and
 * toggles ".active", so the fade/scale transition runs on open and close.
 * Closes on overlay click and Escape; locks page scroll while any is open.
 */
export default function Modal({ open, onClose, title, titleTag = 'h3', size = 'md', footer, children, zIndex }: ModalProps) {
    useEffect(() => {
        if (!open) return;
        openCount++;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            openCount = Math.max(0, openCount - 1);
            if (openCount === 0) document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const TitleTag = titleTag;
    return createPortal(
        <div
            className={`modal-overlay${open ? ' active' : ''}`}
            style={zIndex ? { zIndex } : undefined}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            aria-hidden={!open}
        >
            <div className={`modal${size === 'lg' ? ' modal-lg' : ''}`} role="dialog" aria-modal="true">
                <div className="modal-header">
                    <TitleTag className="modal-title">{title}</TitleTag>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon as={X} /></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>,
        document.body,
    );
}
