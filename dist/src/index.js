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
exports.OrderNotificationManager = void 0;
class OrderNotificationManager {
    constructor(config) {
        var _a, _b, _c;
        this.supabase = config.supabase;
        this.userId = config.userId;
        this.userRole = config.userRole;
        this.audioFiles = new Map();
        this.subscription = null;
        this.isInitialized = false;
        this.enableBrowserNotifications = (_a = config.enableBrowserNotifications) !== null && _a !== void 0 ? _a : false;
        this.tableName = (_b = config.tableName) !== null && _b !== void 0 ? _b : 'order_notifications';
        this.channelName = (_c = config.channelName) !== null && _c !== void 0 ? _c : 'order-notifications';
        // Default audio URLs - you can host these files or use data URLs
        this.defaultSounds = {
            supplier: '../sounds/notify-alert-1.mp3',
            ops: '../sounds/notify-alert-2.mp3',
            default: '../sounds/notify-alert-4.mp3',
        };
        this.customSounds = config.sounds || {};
        this.sounds = Object.assign(Object.assign({}, this.defaultSounds), this.customSounds);
        this.onNotificationCallback = config.onNotification;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized)
                return;
            try {
                // Request browser notification permission if enabled
                if (this.enableBrowserNotifications) {
                    yield this.requestBrowserNotificationPermission();
                }
                // Preload audio files for better performance
                yield this.preloadAudio();
                // Set up real-time subscription
                this.setupRealtimeSubscription();
                this.isInitialized = true;
                console.log('Order notification system initialized');
            }
            catch (error) {
                console.error('Failed to initialize notification system:', error);
                throw error;
            }
        });
    }
    requestBrowserNotificationPermission() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!('Notification' in window)) {
                console.warn('Browser notifications not supported');
                return;
            }
            if (Notification.permission === 'default') {
                const permission = yield Notification.requestPermission();
                console.log('Notification permission:', permission);
            }
        });
    }
    preloadAudio() {
        return __awaiter(this, void 0, void 0, function* () {
            const loadPromises = Object.entries(this.sounds).map((_a) => __awaiter(this, [_a], void 0, function* ([key, url]) {
                try {
                    const audio = new Audio(url);
                    // Preload the audio
                    return new Promise((resolve) => {
                        const onCanPlay = () => {
                            this.audioFiles.set(key, audio);
                            audio.removeEventListener('canplaythrough', onCanPlay);
                            audio.removeEventListener('error', onError);
                            resolve();
                        };
                        const onError = (e) => {
                            console.warn(`Failed to load audio file for ${key}:`, e);
                            audio.removeEventListener('canplaythrough', onCanPlay);
                            audio.removeEventListener('error', onError);
                            resolve(); // Don't reject, just warn
                        };
                        audio.addEventListener('canplaythrough', onCanPlay);
                        audio.addEventListener('error', onError);
                        audio.preload = 'auto';
                        audio.load();
                    });
                }
                catch (error) {
                    console.warn(`Error loading audio for ${key}:`, error);
                }
            }));
            yield Promise.all(loadPromises);
        });
    }
    setupRealtimeSubscription() {
        // Subscribe to order_notifications table
        const channel = this.supabase.channel(this.channelName);
        this.subscription = channel
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: this.tableName,
        }, (payload) => {
            void this.handleNotification(payload.new);
        })
            .subscribe((status) => {
            console.log('Subscription status:', status);
        });
    }
    handleNotification(notification) {
        return __awaiter(this, void 0, void 0, function* () {
            const { order_id, target_suppliers = [], notification_type = 'default', metadata = {}, } = notification;
            console.log('Received notification:', notification);
            // Determine if this user should receive the notification
            const shouldPlay = this.shouldPlayNotification(target_suppliers, notification_type);
            if (shouldPlay) {
                yield this.playNotificationSound(notification_type, metadata);
                // Show browser notification if enabled
                if (this.enableBrowserNotifications) {
                    this.showBrowserNotification(notification);
                }
                // Trigger custom callback if provided
                if (this.onNotificationCallback) {
                    this.onNotificationCallback({
                        orderId: order_id,
                        type: notification_type,
                        metadata,
                        targetSuppliers: target_suppliers,
                    });
                }
            }
        });
    }
    shouldPlayNotification(targetSuppliers, _notificationType) {
        // Always play for ops role
        if (this.userRole === 'ops' || this.userRole === 'admin') {
            return true;
        }
        // For suppliers, check if they're in the target list
        if (this.userRole === 'supplier') {
            return targetSuppliers.includes(this.userId);
        }
        // Default behavior
        return targetSuppliers.length === 0 || targetSuppliers.includes(this.userId);
    }
    playNotificationSound() {
        return __awaiter(this, arguments, void 0, function* (type = 'default', metadata = {}) {
            try {
                // Determine which sound to play based on priority and role
                const soundKey = this.determineSoundKey(type, metadata);
                const audio = this.audioFiles.get(soundKey);
                if (audio) {
                    // Clone audio for concurrent playback support
                    const audioClone = audio.cloneNode();
                    audioClone.currentTime = 0;
                    yield audioClone.play();
                }
                else {
                    console.warn('No audio file found for:', soundKey);
                }
            }
            catch (error) {
                console.error('Error playing notification sound:', error);
            }
        });
    }
    determineSoundKey(type, metadata) {
        // Priority-based sound selection
        if (metadata.priority === 'urgent' && this.audioFiles.has('urgent')) {
            return 'urgent';
        }
        if (metadata.priority === 'high' && this.audioFiles.has('high_priority')) {
            return 'high_priority';
        }
        // Role-based sound selection
        if (this.userRole === 'ops' && this.audioFiles.has('ops')) {
            return 'ops';
        }
        else if (this.userRole === 'supplier' && this.audioFiles.has('supplier')) {
            return 'supplier';
        }
        else if (this.audioFiles.has(type)) {
            return type;
        }
        return 'default';
    }
    showBrowserNotification(notification) {
        var _a;
        if (Notification.permission !== 'granted')
            return;
        const title = this.getNotificationTitle(notification);
        const body = this.getNotificationBody(notification);
        const icon = '/favicon.ico'; // You can customize this
        new Notification(title, {
            body,
            icon,
            tag: `order-${notification.order_id}`, // Prevent duplicate notifications
            requireInteraction: ((_a = notification.metadata) === null || _a === void 0 ? void 0 : _a.priority) === 'urgent',
        });
    }
    getNotificationTitle(notification) {
        const { notification_type, metadata } = notification;
        switch (notification_type) {
            case 'order_created':
                return 'New Order Received!';
            case 'order_cancelled':
                return 'Order Cancelled';
            case 'ops_alert':
                return (metadata === null || metadata === void 0 ? void 0 : metadata.urgency) === 'high' ? '🚨 Urgent Alert' : 'Operations Alert';
            default:
                return 'New Notification';
        }
    }
    getNotificationBody(notification) {
        const { order_id, metadata } = notification;
        if (metadata === null || metadata === void 0 ? void 0 : metadata.message) {
            return metadata.message;
        }
        if (metadata === null || metadata === void 0 ? void 0 : metadata.customerName) {
            return `Order #${order_id} from ${metadata.customerName}`;
        }
        return `Order #${order_id}`;
    }
    // Static method to be called from your backend when order is created
    static dispatchOrderNotification(supabase_1, orderData_1) {
        return __awaiter(this, arguments, void 0, function* (supabase, orderData, tableName = 'order_notifications') {
            const { orderId, targetSuppliers = [], notificationType = 'order_created', metadata = {}, } = orderData;
            try {
                const { error } = yield supabase.from(tableName).insert({
                    order_id: orderId,
                    target_suppliers: targetSuppliers,
                    notification_type: notificationType,
                    metadata: metadata,
                    created_at: new Date().toISOString(),
                });
                if (error)
                    throw error;
                console.log('Order notification dispatched:', orderId);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to dispatch notification:', error);
                return { success: false, error };
            }
        });
    }
    // Set custom notification handler
    setOnNotification(callback) {
        this.onNotificationCallback = callback;
    }
    // Test notification (useful for debugging)
    testNotification() {
        return __awaiter(this, arguments, void 0, function* (type = 'default') {
            yield this.playNotificationSound(type, { priority: 'normal' });
        });
    }
    // Get current initialization status
    get ready() {
        return this.isInitialized;
    }
    // Get available sound keys
    get availableSounds() {
        return Array.from(this.audioFiles.keys());
    }
    // Clean up subscription and resources
    destroy() {
        if (this.subscription) {
            void this.supabase.removeChannel(this.subscription);
            this.subscription = null;
        }
        // Clean up audio objects
        this.audioFiles.clear();
        this.isInitialized = false;
    }
}
exports.OrderNotificationManager = OrderNotificationManager;
