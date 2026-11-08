import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { portalService } from '../services/portalService';
import type { CareerLink } from '../types/portal';

interface PortalValue {
    /** The careers slide's positions, each linked to its active job posting. */
    careers: CareerLink[];
}

const PortalContext = createContext<PortalValue>({ careers: [] });

/**
 * Opens the portal session (CSRF token) once, before any page runs - the
 * former PHP pages always had the token in their markup, and the screening /
 * recommendation steps call the API as soon as they open.
 */
export function PortalProvider({ children }: { children: ReactNode }) {
    const [value, setValue] = useState<PortalValue | null>(null);

    useEffect(() => {
        portalService.bootstrap()
            .then(data => setValue({ careers: data.careers ?? [] }))
            .catch(() => setValue({ careers: [] })); // pages still render; API calls report the problem
    }, []);

    if (!value) return null;
    return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalValue {
    return useContext(PortalContext);
}
