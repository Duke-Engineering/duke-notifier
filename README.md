# Duke Prompts

A comprehensive, type-safe real-time notification system for e-commerce applications using Supabase and React.

## 🚀 Features

- **Full TypeScript Support** - Complete type safety and IntelliSense
- **Real-time Notifications** - Powered by Supabase real-time subscriptions
- **Audio Alerts** - Customizable sounds with priority-based playback
- **Role-based Filtering** - Smart notification routing for suppliers/ops
- **Browser Notifications** - Native browser notification support
- **React Integration** - Easy-to-use React hooks
- **Error Handling** - Robust retry and fallback mechanisms

## 📦 Installation

```bash
# NPM
npm install duke @supabase/supabase-js
# or install pre-built version from GitHub
npm install github:Duke-Engineering/duke-notifier#dist

# Yarn
yarn add duke @supabase/supabase-js
# or install pre-built version from GitHub
yarn add github:Duke-Engineering/duke-notifier#dist

# PNPM
pnpm add duke @supabase/supabase-js
# or install pre-built version from GitHub
pnpm add github:Duke-Engineering/duke-notifier#dist
```

## 🏗️ Database Setup

1. **Create the notifications table in Supabase**:

```sql
-- Run this in your Supabase SQL editor
CREATE TABLE order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) NOT NULL,
    target_suppliers TEXT[] DEFAULT '{}',
    notification_type VARCHAR(100) DEFAULT 'order_created',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Add indexes
CREATE INDEX idx_order_notifications_created_at ON order_notifications(created_at DESC);
CREATE INDEX idx_order_notifications_order_id ON order_notifications(order_id);
CREATE INDEX idx_order_notifications_type ON order_notifications(notification_type);

-- Enable RLS
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read relevant notifications" ON order_notifications
    FOR SELECT USING (
        auth.jwt() ->> 'user_role' = 'ops'
        OR
        (auth.jwt() ->> 'user_role' = 'supplier' AND auth.uid()::text = ANY(target_suppliers))
        OR
        array_length(target_suppliers, 1) IS NULL
    );

CREATE POLICY "Service role can insert notifications" ON order_notifications
    FOR INSERT WITH CHECK (true);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE order_notifications;
```

2. **Add audio files to your public directory**:

```plaintext
public/
  sounds/
    notify-alert-1.mp3
    notify-alert-2.mp3
    notify-alert-3.mp3
    notify-alert-4.mp3
    notify-alert-5.wav
```

## 🔧 Basic Setup

### 1. Initialize Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### 2. React Component Integration

```typescript
// components/OrderDashboard.tsx
import React from 'react';
import { useOrderNotifications } from 'duke/react';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
  userRole: 'supplier' | 'ops' | 'admin';
}

export const OrderDashboard: React.FC<Props> = ({ userId, userRole }) => {
  const { manager, isReady, error } = useOrderNotifications({
    supabase,
    userId,
    userRole,
    enableBrowserNotifications: true,
    sounds: {
      supplier: '/sounds/notify-alert-1.mp3',
      ops: '/sounds/notify-alert-2.mp3',
      urgent: '/sounds/notify-alert-3.mp3'
    },
    onNotification: (notification) => {
      console.log('New notification:', notification);
      // Handle notification in your UI
      showToast(`New order #${notification.orderId}`);
    }
  });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h1>Order Dashboard</h1>
      <div>Status: {isReady ? '🟢 Connected' : '🟡 Connecting...'}</div>

      <button
        onClick={() => manager?.testNotification('supplier')}
        disabled={!isReady}
      >
        Test Notification Sound
      </button>

      {/* Your dashboard content */}
    </div>
  );
};
```

### 3. Backend Integration

```typescript
// lib/notifications.ts
import { OrderNotificationManager } from 'duke';
import { supabase } from './supabase';

export async function notifyOrderCreated(orderData: {
  orderId: string;
  supplierId: string;
  customerName: string;
  orderValue: number;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}) {
  const result = await OrderNotificationManager.dispatchOrderNotification(supabase, {
    orderId: orderData.orderId,
    targetSuppliers: [orderData.supplierId],
    notificationType: 'order_created',
    metadata: {
      customerName: orderData.customerName,
      orderValue: orderData.orderValue,
      priority: orderData.priority || 'normal',
    },
  });

  if (!result.success) {
    console.error('Failed to send notification:', result.error);
  }

  return result;
}
```

## 📊 Type Definitions

The library exports comprehensive TypeScript definitions:

```typescript
import type {
  OrderNotificationConfig,
  ProcessedNotification,
  NotificationMetadata,
  UserRole,
  NotificationType,
  SoundKey,
  SoundConfig,
  DispatchNotificationData,
  DispatchResult,
} from 'duke';
```

## 🔐 Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🚀 Deployment Checklist

- [ ] Database table created with proper RLS policies
- [ ] Audio files uploaded to public directory
- [ ] Environment variables configured
- [ ] Browser notification permissions requested
- [ ] Audio files optimized for web (< 100KB each)

## 🐛 Troubleshooting

### Common Issues

1. **Audio files not loading**
   - Check file paths and formats (MP3/WAV supported)
   - Ensure files are in public directory
   - Check browser autoplay policies

2. **Notifications not received**
   - Verify RLS policies in Supabase
   - Check user authentication
   - Confirm real-time is enabled on table

3. **TypeScript errors**
   - Ensure @types/react is installed
   - Check TypeScript version (>= 4.0.0)
   - Verify Supabase types are generated

### Debug Mode

```typescript
// Enable debug logging
const manager = new OrderNotificationManager({
  ...config,
  debug: true, // Enables verbose logging
});
```

## 📖 API Reference

### OrderNotificationManager

```typescript
class OrderNotificationManager {
  constructor(config: OrderNotificationConfig);

  async initialize(): Promise<void>;
  async testNotification(type?: string): Promise<void>;
  setOnNotification(callback: NotificationEventHandler): void;
  destroy(): void;

  get ready(): boolean;
  get availableSounds(): string[];

  static async dispatchOrderNotification(
    supabase: SupabaseClient,
    data: DispatchNotificationData,
    tableName?: string
  ): Promise<DispatchResult>;
}
```

### useOrderNotifications Hook

```typescript
function useOrderNotifications(config: OrderNotificationConfig): {
  manager: OrderNotificationManager | null;
  isReady: boolean;
  error: Error | null;
};
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/duke.git

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for real-time infrastructure
- [React](https://reactjs.org) for the component system
- [TypeScript](https://www.typescriptlang.org) for type safety
