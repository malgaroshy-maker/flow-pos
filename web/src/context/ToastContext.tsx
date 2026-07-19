import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextType {
  triggerToast: (msg: string, type?: 'success' | 'alert') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'alert'>('success');

  const triggerToast = useCallback((msg: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ triggerToast }}>
      {children}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-card shadow-xl font-display font-bold text-sm text-white flex items-center gap-3 transition-all ${
            toastType === 'alert' ? 'bg-alert' : 'bg-jade'
          }`}
          dir="rtl"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
