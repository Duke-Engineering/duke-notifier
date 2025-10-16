"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
// Mocks
jest.mock('@supabase/supabase-js');
const mockAudio = {
    addEventListener: jest.fn((event, cb) => {
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
const mockSupabase = {
    channel: jest.fn().mockReturnValue(mockChannel),
    removeChannel: jest.fn(),
    from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
    }),
};
// Test fixtures
const defaultConfig = {
    supabase: mockSupabase,
    userId: 'test-user',
    userRole: 'supplier',
    enableBrowserNotifications: false,
};
describe('OrderNotificationManager', () => {
    let manager;
    beforeEach(() => {
        jest.clearAllMocks();
        manager = new src_1.OrderNotificationManager(defaultConfig);
    });
    describe('constructor', () => {
        it('should initialize with default config', () => {
            expect(manager['userId']).toBe('test-user');
            expect(manager['userRole']).toBe('supplier');
            expect(manager['tableName']).toBe('order_notifications');
            expect(manager['channelName']).toBe('order-notifications');
        });
        it('should merge custom sounds with defaults', () => {
            const customConfig = Object.assign(Object.assign({}, defaultConfig), { sounds: { custom: 'custom.mp3' } });
            const customManager = new src_1.OrderNotificationManager(customConfig);
            expect(customManager['sounds']).toHaveProperty('custom');
            expect(customManager['sounds']).toHaveProperty('default');
        });
    });
    describe('initialize', () => {
        beforeEach(() => {
            global.Notification = {
                permission: 'default',
                requestPermission: jest.fn().mockResolvedValue('granted'),
            };
        });
        it('should initialize successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            yield manager.initialize();
            expect(manager['isInitialized']).toBe(true);
            expect(mockSupabase.channel).toHaveBeenCalled();
        }));
        it('should not initialize twice', () => __awaiter(void 0, void 0, void 0, function* () {
            yield manager.initialize();
            yield manager.initialize();
            expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
        }));
    });
    describe('notification handling', () => {
        it('should determine correct playback for ops role', () => {
            const opsManager = new src_1.OrderNotificationManager(Object.assign(Object.assign({}, defaultConfig), { userRole: 'ops' }));
            expect(opsManager['shouldPlayNotification']([], 'default')).toBe(true);
        });
        it('should determine correct playback for supplier role', () => {
            expect(manager['shouldPlayNotification'](['test-user'], 'default')).toBe(true);
            expect(manager['shouldPlayNotification'](['other-user'], 'default')).toBe(false);
        });
    });
    describe('static methods', () => {
        it('should dispatch notification successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield src_1.OrderNotificationManager.dispatchOrderNotification(mockSupabase, {
                orderId: '123',
            });
            expect(result.success).toBe(true);
        }));
    });
    describe('cleanup', () => {
        it('should clean up resources on destroy', () => __awaiter(void 0, void 0, void 0, function* () {
            yield manager.initialize();
            manager.destroy();
            expect(manager['isInitialized']).toBe(false);
            expect(manager['subscription']).toBeNull();
            expect(mockSupabase.removeChannel).toHaveBeenCalled();
        }));
    });
    describe('utility methods', () => {
        it('should report ready status correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(manager.ready).toBe(false);
            yield manager.initialize();
            expect(manager.ready).toBe(true);
        }));
        it('should handle notification callbacks', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCallback = jest.fn();
            manager.setOnNotification(mockCallback);
            const notification = {
                order_id: '123',
                notification_type: 'test',
                target_suppliers: ['test-user'],
                metadata: {},
            };
            yield manager['handleNotification'](notification);
            expect(mockCallback).toHaveBeenCalled();
        }));
    });
});
