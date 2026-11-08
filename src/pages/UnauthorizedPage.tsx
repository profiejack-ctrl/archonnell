import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldX } from 'lucide-react';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/AuthContext';
import { useLoginStyles } from './LoginPage';

/** 403 page (same card as the legacy unauthorized.php). */
export default function UnauthorizedPage() {
    useLoginStyles();
    const { session } = useAuth();

    useEffect(() => { document.title = 'Access Denied - Archon Nell Incorporated'; }, []);

    return (
        <div className="login-wrapper">
            <div className="login-card" style={{ textAlign: 'center' }}>
                <div className="denied-icon"><Icon as={ShieldX} /></div>
                <div className="denied-code">403</div>
                <h2 className="login-title">Access Denied</h2>
                <p className="login-subtitle">You do not have permission to access this page.</p>
                {session && (
                    <p className="login-footer-note" style={{ marginTop: '1rem' }}>
                        Signed in as <strong>{session.user.username}</strong> ({session.user.role_name})
                    </p>
                )}
                <Link to="/" className="btn-submit" style={{ display: 'inline-flex', textDecoration: 'none', marginTop: '1.5rem' }}>
                    <Icon as={ArrowLeft} />&nbsp; Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
