import { OrderNotificationManager } from '../..';
import { OrderNotificationConfig } from '../../types';
export interface UseOrderNotificationsResult {
    manager: OrderNotificationManager | null;
    isReady: boolean;
    testNotification: (type?: string) => Promise<void>;
    error: Error | null;
}
export declare function useOrderNotifications(config: OrderNotificationConfig): UseOrderNotificationsResult;
