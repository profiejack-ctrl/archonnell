import { api, httpUpload } from './http';
import type { Announcement, DashboardAnnouncement, Department, NotificationItem, WorkflowNotification } from '../types';

export interface AnnouncementInput {
    title: string;
    summary: string;
    body: string;
    published_at: string;
    end_at: string;
    show_on_dashboard: '1' | '0';
    scope_all: '1' | '0';
    departments: string[];
    cover_image: string;
    is_draft: '1' | '0';
    status: string;
}

/** Administration > Announcement, the employee dashboard feed and the notification bell. */
export const announcementService = {
    page: () => api.get<{ announcements: Announcement[]; departments: Department[] }>('page_announcements'),
    create: (input: AnnouncementInput) => api.post<{ message: string; id: number }>('create_announcement', { ...input }),
    update: (id: number, input: AnnouncementInput) => api.post<{ message: string }>('update_announcement', { ...input, id }),
    publish: (id: number) => api.post<{ message: string }>('publish_announcement', { id }),
    withdraw: (id: number) => api.post<{ message: string }>('withdraw_announcement', { id }),
    copy: (id: number) => api.post<{ message: string; id: number }>('copy_announcement', { id }),
    remove: (id: number) => api.post<{ message: string }>('delete_announcement', { id }),
    bulkRemove: (ids: number[]) =>
        api.post<{ message: string; deleted: number[]; skipped: Record<string, string> }>('bulk_delete_announcements', { ids: ids.join(',') }),
    uploadCover: (file: File) => httpUpload<{ cover_image: string }>('upload-announcement-cover.php', { file }),

    dashboard: (passive = false) => api.get<{ data: DashboardAnnouncement[] }>('dashboard_announcements', {}, { passive }),
    dashboardDetail: (id: number) => api.get<{ data: DashboardAnnouncement }>('dashboard_announcement_detail', { id }),

    notifications: (passive = false) =>
        api.get<{ unread_count: number; data: NotificationItem[]; workflow: WorkflowNotification[] }>('notifications', {}, { passive }),
    /** A workflow notification (vacancy request / job posting) was opened. */
    markWorkflowRead: (id: number) => api.post<{ unread_count: number }>('workflow_notification_read', { id }),
    markRead: (id: number) => api.post<{ unread_count: number }>('notification_read', { id }),
    markAllRead: () => api.post<{ marked: number; unread_count: number }>('notifications_read_all'),
};
