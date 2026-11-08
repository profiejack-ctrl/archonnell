import { api } from './http';
import type { Department, DirectoryUser, Employee, Position, Role } from '../types';

export interface DirectoryCards {
    total_users: number;
    active_accounts: number;
    deactivated_accounts: number;
    active_departments: number;
}

export interface UserDirectoryPage {
    cards: DirectoryCards;
    users: DirectoryUser[];
    departments: Department[];
    positions: Position[];
    roles: Role[];
}

export interface RegisterUserPage {
    employees: Employee[];
    departments: Department[];
    positions: Position[];
    roles: Role[];
}

export interface UserInput {
    first_name: string;
    last_name: string;
    middle_name: string;
    email: string;
    mobile_number: string;
    department: string;
    position: string;
    role_id: string | number;
}

export interface RoleMatrix {
    roles: { id: number; role_name: string; description: string | null; user_count: number }[];
    permissions: { id: number; permission_name: string; description: string | null }[];
    grants: [number, number][];
}

/** User Management, Roles and Permissions (Administration). */
export const userService = {
    directoryPage: () => api.get<UserDirectoryPage>('page_user_directory'),
    directoryCards: () => api.get<{ cards: DirectoryCards }>('user_directory'),
    view: (id: number) => api.get<{ user: DirectoryUser & { full_name: string | null; employment_status: string | null } }>('view_user', { id }),
    registerPage: () => api.get<RegisterUserPage>('page_register_user'),
    register: (input: UserInput & { employee_id: string | number }) =>
        api.post<{ message: string; username: string; default_password: string; employee_no: string; email_sent: boolean; email_error: string | null }>(
            'register_system_user', { ...input },
        ),
    update: (userId: number, input: UserInput) => api.post<{ message: string }>('update_system_user', { ...input, user_id: userId }),
    toggleStatus: (userId: number) => api.post<{ message: string; status: string }>('toggle_user_status', { user_id: userId }),
    archive: (userId: number) => api.post<{ message: string }>('archive_user', { user_id: userId }),

    rolesPage: () => api.get<RoleMatrix>('page_roles'),
    saveRoleMatrix: (checked: string[]) => api.post<{ message: string }>('save_role_matrix', { perm: checked }),
    permissionsPage: () =>
        api.get<{ permissions: { id: number; permission_name: string; description: string | null; role_count: number }[] }>('page_permissions'),
    createPermission: (name: string, description: string) =>
        api.post<{ message: string }>('create_permission', { permission_name: name, description }),
};
