import { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationMetadata {
  customerName?: string;
  orderValue?: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  alertType?: string;
  message?: string;
  urgency?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

export interface OrderNotification {
  id?: string;
  order_id: string;
  target_suppliers?: string[];
  notification_type?: string;
  metadata?: NotificationMetadata;
  created_at?: string;
  processed_at?: string | null;
}

export interface ProcessedNotification {
  orderId: string;
  type: string;
  metadata: NotificationMetadata;
  targetSuppliers: string[];
}

export type UserRole = 'supplier' | 'ops' | 'admin' | 'customer';
export type NotificationType =
  | 'order_created'
  | 'order_cancelled'
  | 'order_updated'
  | 'ops_alert'
  | 'default';
export type AudioKeys = string;

export interface SoundConfig {
  [key: string]: string;
}

export interface OrderNotificationConfig {
  supabase: SupabaseClient;
  userId: string;
  userRole: UserRole;
  sounds?: SoundConfig;
  onNotification?: (notification: ProcessedNotification) => void;
  enableBrowserNotifications?: boolean;
  tableName?: string;
  channelName?: string;
}

export interface DispatchNotificationData {
  orderId: string;
  targetSuppliers?: string[];
  notificationType?: NotificationType;
  metadata?: NotificationMetadata;
}

export interface DispatchResult {
  success: boolean;
  error?: unknown;
}

export const isOrderNotification = (obj: unknown): obj is OrderNotification => {
  if (typeof obj !== 'object' || obj === null) return false;
  const notification = obj as Record<string, unknown>;
  return (
    typeof notification.order_id === 'string' &&
    (notification.target_suppliers === undefined ||
      (Array.isArray(notification.target_suppliers) &&
        notification.target_suppliers.every((s) => typeof s === 'string'))) &&
    (notification.notification_type === undefined ||
      typeof notification.notification_type === 'string') &&
    (notification.metadata === undefined || typeof notification.metadata === 'object')
  );
};

export const isProcessedNotification = (obj: unknown): obj is ProcessedNotification => {
  if (typeof obj !== 'object' || obj === null) return false;
  const notification = obj as Record<string, unknown>;
  return (
    typeof notification.orderId === 'string' &&
    typeof notification.type === 'string' &&
    Array.isArray(notification.targetSuppliers) &&
    notification.targetSuppliers.every((s) => typeof s === 'string') &&
    (notification.metadata === undefined || typeof notification.metadata === 'object')
  );
};
