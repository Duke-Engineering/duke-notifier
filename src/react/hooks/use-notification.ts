import { useEffect, useState } from 'react';
import { OrderNotificationManager } from '../..';
import { OrderNotificationConfig } from '../../types';

export interface UseOrderNotificationsResult {
  manager: OrderNotificationManager | null;
  isReady: boolean;
  testNotification: (type?: string) => Promise<void>;
  error: Error | null;
}

export function useOrderNotifications(
  config: OrderNotificationConfig
): UseOrderNotificationsResult {
  const [manager, setManager] = useState<OrderNotificationManager | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const notificationManager = new OrderNotificationManager(config);

    notificationManager
      .initialize()
      .then(() => {
        setManager(notificationManager);
        setIsReady(true);
        setError(null);
      })
      .catch((initError: Error) => {
        console.error('Failed to initialize notifications:', initError);
        setError(initError);
      });

    return () => {
      if (notificationManager) {
        notificationManager.destroy();
      }
    };
  }, [config]); // Re-initialize if config changes

  const testNotification = async (type: string = 'default'): Promise<void> => {
    if (manager) {
      await manager.testNotification(type);
    }
  };

  return {
    manager,
    isReady,
    testNotification,
    error,
  };
}
