import api from '@/lib/apiAxios';

export interface InboxNotification {
  _id: string;
  type: 'email_notification' | 'stalled_conversation' | 'appointment_reminder' | 'escalated_conversation' | 'booking_cancelled' | 'new_user_joined';
  title: string;
  description: string;
  isRead: boolean;
  relatedEntityId?: string;
  relatedEntityType?: 'conversation' | 'appointment' | 'user';
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: InboxNotification[];
  total: number;
  totalPages: number;
}

export function fetchNotifications(page = 1): Promise<NotificationsResponse> {
  return api.get<NotificationsResponse>(`/inbox-notifications?page=${page}`).then((r) => r.data);
}

export function fetchUnreadCount(): Promise<number> {
  return api
    .get<{ count: number }>('/inbox-notifications/unread-count')
    .then((r) => r.data.count)
    .catch(() => 0);
}

export function markNotificationRead(id: string): Promise<void> {
  return api.patch(`/inbox-notifications/${id}/read`).then(() => undefined);
}

export function markAllNotificationsRead(): Promise<void> {
  return api.patch('/inbox-notifications/read-all').then(() => undefined);
}

export function dismissNotification(id: string): Promise<void> {
  return api.delete(`/inbox-notifications/${id}`).then(() => undefined);
}