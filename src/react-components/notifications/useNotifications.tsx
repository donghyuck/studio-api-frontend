// src/react-components/notifications/useNotifications.ts
import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

export type NotificationType = "success" | "error" | "info";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: number;
  read: boolean;
}

interface NotificationsContextType {
  items: NotificationItem[];
  unreadCount: number;
  addNotification: (payload: Omit<NotificationItem, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

interface NotificationsProviderProps {
  children: ReactNode;
  maxItems?: number;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children, maxItems = 20 }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const addNotification = useCallback((payload: Omit<NotificationItem, "id" | "createdAt" | "read">) => {
    const next: NotificationItem = {
      id: createId(),
      createdAt: Date.now(),
      read: false,
      ...payload,
    };
    setItems(prevItems => [next, ...prevItems].slice(0, maxItems));
  }, [maxItems]);

  const markNotificationRead = useCallback((id: string) => {
    setItems(prevItems =>
      prevItems.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setItems(prevItems =>
      prevItems.map((item) => ({ ...item, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id: string) => {
    setItems(prevItems => prevItems.filter((item) => item.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setItems([]);
  }, []);

  const contextValue = useMemo(() => ({
    items,
    unreadCount,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
  }), [items, unreadCount, addNotification, markNotificationRead, markAllNotificationsRead, removeNotification, clearNotifications]);

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
