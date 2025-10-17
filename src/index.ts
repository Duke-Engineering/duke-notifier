import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  DispatchNotificationData,
  DispatchResult,
  NotificationMetadata,
  OrderNotification,
  OrderNotificationConfig,
  ProcessedNotification,
  SoundConfig,
  UserRole,
} from './types';

// Re-export types for consumer convenience
export type {
  DispatchNotificationData,
  DispatchResult,
  NotificationMetadata,
  OrderNotification,
  OrderNotificationConfig,
  ProcessedNotification,
  SoundConfig,
  UserRole,
  NotificationType,
  AudioKeys,
} from './types';
export { isOrderNotification, isProcessedNotification } from './types';

export class OrderNotificationManager {
  private supabase: SupabaseClient;
  private userId: string;
  private userRole: UserRole;
  private audioFiles: Map<string, HTMLAudioElement>;
  private subscription: RealtimeChannel | null;
  private isInitialized: boolean;
  private defaultSounds: SoundConfig;
  private customSounds: SoundConfig;
  private sounds: SoundConfig;
  private onNotificationCallback?: (notification: ProcessedNotification) => void;
  private enableBrowserNotifications: boolean;
  private tableName: string;
  private channelName: string;

  constructor(config: OrderNotificationConfig) {
    this.supabase = config.supabase;
    this.userId = config.userId;
    this.userRole = config.userRole;
    this.audioFiles = new Map<string, HTMLAudioElement>();
    this.subscription = null;
    this.isInitialized = false;
    this.enableBrowserNotifications = config.enableBrowserNotifications ?? false;
    this.tableName = config.tableName ?? 'order_notifications';
    this.channelName = config.channelName ?? 'order-notifications';

    // Default audio URLs - you can host these files or use data URLs
    this.defaultSounds = {
      supplier: '../sounds/notify-alert-1.mp3',
      ops: '../sounds/notify-alert-2.mp3',
      default: '../sounds/notify-alert-4.mp3',
    };

    this.customSounds = config.sounds || {};
    this.sounds = { ...this.defaultSounds, ...this.customSounds };
    this.onNotificationCallback = config.onNotification;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request browser notification permission if enabled
      if (this.enableBrowserNotifications) {
        await this.requestBrowserNotificationPermission();
      }

      // Preload audio files for better performance
      await this.preloadAudio();

      // Set up real-time subscription
      this.setupRealtimeSubscription();

      this.isInitialized = true;
      console.log('Order notification system initialized');
    } catch (error) {
      console.error('Failed to initialize notification system:', error);
      throw error;
    }
  }

  private async requestBrowserNotificationPermission(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  }

  private async preloadAudio(): Promise<void> {
    const loadPromises = Object.entries(this.sounds).map(async ([key, url]: [string, string]) => {
      try {
        const audio = new Audio(url);

        // Preload the audio
        return new Promise<void>((resolve) => {
          const onCanPlay = () => {
            this.audioFiles.set(key, audio);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            resolve();
          };

          const onError = (e: Event) => {
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
      } catch (error) {
        console.warn(`Error loading audio for ${key}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  private setupRealtimeSubscription(): void {
    // Subscribe to order_notifications table
    const channel = this.supabase.channel(this.channelName);
    this.subscription = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: this.tableName,
        },
        (payload: { new: OrderNotification }) => {
          void this.handleNotification(payload.new);
        }
      )
      .subscribe((status: string) => {
        console.log('Subscription status:', status);
      });
  }

  private async handleNotification(notification: OrderNotification): Promise<void> {
    const {
      order_id,
      target_suppliers = [],
      notification_type = 'default',
      metadata = {},
    } = notification;

    console.log('Received notification:', notification);

    // Determine if this user should receive the notification
    const shouldPlay = this.shouldPlayNotification(target_suppliers);

    if (shouldPlay) {
      await this.playNotificationSound(notification_type, metadata);

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
  }

  private shouldPlayNotification(targetSuppliers: string[]): boolean {
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

  private async playNotificationSound(
    type: string = 'default',
    metadata: NotificationMetadata = {}
  ): Promise<void> {
    try {
      // Determine which sound to play based on priority and role
      const soundKey = this.determineSoundKey(type, metadata);

      const audio = this.audioFiles.get(soundKey);
      if (audio) {
        // Clone audio for concurrent playback support
        const audioClone = audio.cloneNode() as HTMLAudioElement;
        audioClone.currentTime = 0;
        await audioClone.play();
      } else {
        console.warn('No audio file found for:', soundKey);
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  private determineSoundKey(type: string, metadata: NotificationMetadata): string {
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
    } else if (this.userRole === 'supplier' && this.audioFiles.has('supplier')) {
      return 'supplier';
    } else if (this.audioFiles.has(type)) {
      return type;
    }

    return 'default';
  }

  private showBrowserNotification(notification: OrderNotification): void {
    if (Notification.permission !== 'granted') return;

    const title = this.getNotificationTitle(notification);
    const body = this.getNotificationBody(notification);
    const icon = '/favicon.ico'; // You can customize this

    new Notification(title, {
      body,
      icon,
      tag: `order-${notification.order_id}`, // Prevent duplicate notifications
      requireInteraction: notification.metadata?.priority === 'urgent',
    });
  }

  private getNotificationTitle(notification: OrderNotification): string {
    const { notification_type, metadata } = notification;

    switch (notification_type) {
      case 'order_created':
        return 'New Order Received!';
      case 'order_cancelled':
        return 'Order Cancelled';
      case 'ops_alert':
        return metadata?.urgency === 'high' ? '🚨 Urgent Alert' : 'Operations Alert';
      default:
        return 'New Notification';
    }
  }

  private getNotificationBody(notification: OrderNotification): string {
    const { order_id, metadata } = notification;

    if (metadata?.message) {
      return metadata.message;
    }

    if (metadata?.customerName) {
      return `Order #${order_id} from ${metadata.customerName}`;
    }

    return `Order #${order_id}`;
  }

  // Static method to be called from your backend when order is created
  public static async dispatchOrderNotification(
    supabase: SupabaseClient,
    orderData: DispatchNotificationData,
    tableName: string = 'order_notifications'
  ): Promise<DispatchResult> {
    const {
      orderId,
      targetSuppliers = [],
      notificationType = 'order_created',
      metadata = {},
    } = orderData;

    try {
      const { error } = await supabase.from(tableName).insert({
        order_id: orderId,
        target_suppliers: targetSuppliers,
        notification_type: notificationType,
        metadata: metadata,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      console.log('Order notification dispatched:', orderId);
      return { success: true };
    } catch (error) {
      console.error('Failed to dispatch notification:', error);
      return { success: false, error };
    }
  }

  // Set custom notification handler
  public setOnNotification(callback: (notification: ProcessedNotification) => void): void {
    this.onNotificationCallback = callback;
  }

  // Test notification (useful for debugging)
  public async testNotification(type: string = 'default'): Promise<void> {
    await this.playNotificationSound(type, { priority: 'normal' });
  }

  // Get current initialization status
  public get ready(): boolean {
    return this.isInitialized;
  }

  // Get available sound keys
  public get availableSounds(): string[] {
    return Array.from(this.audioFiles.keys());
  }

  // Clean up subscription and resources
  public destroy(): void {
    if (this.subscription) {
      void this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }

    // Clean up audio objects
    this.audioFiles.clear();
    this.isInitialized = false;
  }
}
