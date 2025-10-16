"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProcessedNotification = exports.isOrderNotification = void 0;
const isOrderNotification = (obj) => {
    if (typeof obj !== 'object' || obj === null)
        return false;
    const notification = obj;
    return (typeof notification.order_id === 'string' &&
        (notification.target_suppliers === undefined ||
            (Array.isArray(notification.target_suppliers) &&
                notification.target_suppliers.every((s) => typeof s === 'string'))) &&
        (notification.notification_type === undefined ||
            typeof notification.notification_type === 'string') &&
        (notification.metadata === undefined || typeof notification.metadata === 'object'));
};
exports.isOrderNotification = isOrderNotification;
const isProcessedNotification = (obj) => {
    if (typeof obj !== 'object' || obj === null)
        return false;
    const notification = obj;
    return (typeof notification.orderId === 'string' &&
        typeof notification.type === 'string' &&
        Array.isArray(notification.targetSuppliers) &&
        notification.targetSuppliers.every((s) => typeof s === 'string') &&
        (notification.metadata === undefined || typeof notification.metadata === 'object'));
};
exports.isProcessedNotification = isProcessedNotification;
