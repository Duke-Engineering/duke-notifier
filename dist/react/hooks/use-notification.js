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
exports.useOrderNotifications = useOrderNotifications;
const react_1 = require("react");
const __1 = require("../..");
function useOrderNotifications(config) {
    const [manager, setManager] = (0, react_1.useState)(null);
    const [isReady, setIsReady] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const notificationManager = new __1.OrderNotificationManager(config);
        notificationManager
            .initialize()
            .then(() => {
            setManager(notificationManager);
            setIsReady(true);
            setError(null);
        })
            .catch((initError) => {
            console.error('Failed to initialize notifications:', initError);
            setError(initError);
        });
        return () => {
            if (notificationManager) {
                notificationManager.destroy();
            }
        };
    }, [config]); // Re-initialize if config changes
    const testNotification = (...args_1) => __awaiter(this, [...args_1], void 0, function* (type = 'default') {
        if (manager) {
            yield manager.testNotification(type);
        }
    });
    return {
        manager,
        isReady,
        testNotification,
        error,
    };
}
