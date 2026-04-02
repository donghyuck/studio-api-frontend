// src/react-components/toast/useToast.ts
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Define the shape of a Toast notification
export interface Toast {
  id: string;
  message: string;
  severity?: 'success' | 'info' | 'warning' | 'error';
  autoHideDuration?: number;
  open: boolean;
}

// Define the shape of the Toast context value
interface ToastContextType {
  showToast: (message: string, severity?: Toast['severity'], autoHideDuration?: number) => void;
  // Internal state for ToastHost to consume
  currentToast: Toast | null;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ToastProvider component
interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, severity: Toast['severity'] = 'info', autoHideDuration: number = 3000) => {
    const id = Date.now().toString(); // Simple ID for now
    setCurrentToast({ id, message, severity, autoHideDuration, open: true });
  }, []);

  const hideToast = useCallback((id: string) => {
    setCurrentToast(prev => prev && prev.id === id ? { ...prev, open: false } : prev);
  }, []);

  const contextValue = {
    showToast,
    currentToast,
    hideToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};

// Custom hook to use the Toast functionality
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
