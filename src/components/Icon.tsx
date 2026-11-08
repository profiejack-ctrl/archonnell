import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

interface IconProps {
    as: LucideIcon;
    className?: string;
    style?: CSSProperties;
    title?: string;
}

/**
 * A Lucide icon placed where the legacy UI had an <i class="ri-..."> glyph.
 * It keeps the <i> wrapper so every existing stylesheet rule that sizes,
 * colours or spaces "... i" applies unchanged; the SVG itself is 1em square
 * and uses currentColor (see styles/icons.css).
 */
export default function Icon({ as: Svg, className, style, title }: IconProps) {
    return (
        <i className={className ? `lc ${className}` : 'lc'} style={style} title={title} aria-hidden={title ? undefined : true}>
            <Svg />
        </i>
    );
}
