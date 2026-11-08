/** The "ANI" orbit mark used on the login card and the collapsed sidebar. */
export default function ArchonLogo({ idSuffix = '', strokeWidth = 2.5 }: { idSuffix?: string; strokeWidth?: number }) {
    const id = (name: string) => `${name}${idSuffix}`;
    return (
        <svg viewBox="0 0 100 100" className="archon-svg">
            <defs>
                <linearGradient id={id('orbit1')} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
                    <stop offset="100%" style={{ stopColor: '#8b5cf6' }} />
                </linearGradient>
                <linearGradient id={id('orbit2')} x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#f59e0b' }} />
                    <stop offset="50%" style={{ stopColor: '#ef4444' }} />
                    <stop offset="100%" style={{ stopColor: '#a855f7' }} />
                </linearGradient>
                <linearGradient id={id('orbit3')} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#eab308' }} />
                    <stop offset="100%" style={{ stopColor: '#f97316' }} />
                </linearGradient>
                <radialGradient id={id('centerGlow')} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style={{ stopColor: '#fde68a' }} />
                    <stop offset="100%" style={{ stopColor: '#fbbf24' }} />
                </radialGradient>
            </defs>
            <ellipse cx="50" cy="50" rx="44" ry="18" fill="none" stroke={`url(#${id('orbit1')})`} strokeWidth={strokeWidth} transform="rotate(30 50 50)" />
            <ellipse cx="50" cy="50" rx="44" ry="18" fill="none" stroke={`url(#${id('orbit2')})`} strokeWidth={strokeWidth} transform="rotate(-30 50 50)" />
            <ellipse cx="50" cy="50" rx="40" ry="20" fill="none" stroke={`url(#${id('orbit3')})`} strokeWidth={strokeWidth} transform="rotate(90 50 50)" />
            <ellipse cx="50" cy="50" rx="20" ry="14" fill={`url(#${id('centerGlow')})`} />
            <text x="50" y="56" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" fill="#22c55e" style={{ letterSpacing: '0.5px' }}>ANI</text>
        </svg>
    );
}
