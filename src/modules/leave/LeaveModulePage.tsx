import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, ListChecks } from 'lucide-react';
import Icon from '../../components/Icon';
import { Page, PageHeader } from '../../components/ui';
import { PERM, useAuth } from '../../hooks/AuthContext';
import MyLeavePage from '../ess/MyLeavePage';
import { SectionSwitch } from '../attendance/shared';
import LeaveManagementPage from './LeaveManagementPage';

type View = 'requests' | 'mine';

/**
 * Leave Management (main sidebar). Super Admin / Admin (Leave Management
 * permission, which the server grants to those roles only) review every
 * employee's leave, plus file their own; everyone else, HR Manager included,
 * only files and follows their own leave requests (enforced by the API).
 */
export default function LeaveModulePage() {
    const { can } = useAuth();
    const [params, setParams] = useSearchParams();

    if (!can(PERM.LEAVE)) {
        return (
            <Page id="leave-management">
                <PageHeader title="Leave Management" subtitle="File leave requests and follow their status" />
                <MyLeavePage />
            </Page>
        );
    }
    const views: { key: View; label: React.ReactNode }[] = [{ key: 'requests', label: <><Icon as={ListChecks} /> Employee Leave Requests</> }];
    if (can(PERM.ESS)) views.push({ key: 'mine', label: <><Icon as={CalendarCheck} /> My Leave</> });
    const view: View = params.get('view') === 'mine' && views.length > 1 ? 'mine' : 'requests';

    return (
        <Page id="leave-management">
            <PageHeader title="Leave Management" subtitle="Employee leave requests, leave types and entitlements" />
            <SectionSwitch id="lvSections" views={views} active={view} onChange={v => setParams({ view: v }, { replace: true })} />
            {view === 'requests' ? <LeaveManagementPage /> : <MyLeavePage />}
        </Page>
    );
}
