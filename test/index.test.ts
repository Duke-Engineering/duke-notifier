import { OrderNotificationManager } from '../src';
import { SupabaseClient } from '@supabase/supabase-js';
import { OrderNotificationConfig } from '../src/types';

// Mocks
jest.mock('@supabase/supabase-js');

const mockAudio = {
  addEventListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'canplaythrough') {
      window.setTimeout(() => cb(), 0);
    }
  }),
  removeEventListener: jest.fn(),
  load: jest.fn(),
  play: jest.fn(),
  cloneNode: jest.fn().mockReturnThis(),
};

global.Audio = jest.fn().mockImplementation(() => mockAudio);

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};

type MockSupabaseClient = {
  channel: jest.Mock;
  removeChannel: jest.Mock;
  from: jest.Mock;
};

const mockSupabase = {
  channel: jest.fn().mockReturnValue(mockChannel),
  removeChannel: jest.fn(),
  from: jest.fn().mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: null }),
  }),
} as MockSupabaseClient & SupabaseClient;

// Test fixtures
const defaultConfig: OrderNotificationConfig = {
  supabase: mockSupabase,
  userId: 'test-user',
  userRole: 'supplier',
  enableBrowserNotifications: false,
};

describe('OrderNotificationManager', () => {
  let manager: OrderNotificationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new OrderNotificationManager(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(manager['userId']).toBe('test-user');
      expect(manager['userRole']).toBe('supplier');
      expect(manager['tableName']).toBe('order_notifications');
      expect(manager['channelName']).toBe('order-notifications');
    });

    it('should merge custom sounds with defaults', () => {
      const customConfig = {
        ...defaultConfig,
        sounds: { custom: 'custom.mp3' },
      };
      const customManager = new OrderNotificationManager(customConfig);
      expect(customManager['sounds']).toHaveProperty('custom');
      expect(customManager['sounds']).toHaveProperty('default');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      global.Notification = {
        permission: 'default',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      } as unknown as typeof Notification;
    });

    it('should initialize successfully', async () => {
      await manager.initialize();
      expect(manager['isInitialized']).toBe(true);
      expect((mockSupabase as MockSupabaseClient).channel).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      await manager.initialize();
      expect((mockSupabase as MockSupabaseClient).channel).toHaveBeenCalledTimes(1);
    });
  });

  describe('notification handling', () => {
    it('should determine correct playback for ops role', () => {
      const opsManager = new OrderNotificationManager({
        ...defaultConfig,
        userRole: 'ops',
      });
      expect(opsManager['shouldPlayNotification']([], 'default')).toBe(true);
    });

    it('should determine correct playback for supplier role', () => {
      expect(manager['shouldPlayNotification'](['test-user'], 'default')).toBe(true);
      expect(manager['shouldPlayNotification'](['other-user'], 'default')).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should dispatch notification successfully', async () => {
      const result = await OrderNotificationManager.dispatchOrderNotification(mockSupabase, {
        orderId: '123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await manager.initialize();
      manager.destroy();
      expect(manager['isInitialized']).toBe(false);
      expect(manager['subscription']).toBeNull();
      expect((mockSupabase as MockSupabaseClient).removeChannel).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should report ready status correctly', async () => {
      expect(manager.ready).toBe(false);
      await manager.initialize();
      expect(manager.ready).toBe(true);
    });

    it('should handle notification callbacks', async () => {
      const mockCallback = jest.fn();
      manager.setOnNotification(mockCallback);

      const notification = {
        order_id: '123',
        notification_type: 'test',
        target_suppliers: ['test-user'],
        metadata: {},
      };

      await manager['handleNotification'](notification);
      expect(mockCallback).toHaveBeenCalled();
    });
  });
});
