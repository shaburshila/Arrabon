"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

import { Icon, type IconName } from "@/components/icons";

interface Toast {
  id: number;
  icon?: IconName;
  message: string;
  tone?: "default" | "danger" | "gold" | "info" | "success";
}

interface ToastOpts extends Partial<Omit<Toast, "id" | "message">> {
  duration?: number;
}

const ToastContext = createContext<{
  dismiss: (id: number) => void;
  push: (msg: string, opts?: ToastOpts) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, opts?: ToastOpts) => {
    const id = ++idRef.current;
    const duration = opts?.duration ?? 3200;
    setToasts((prev) => [
      ...prev,
      { id, message, icon: opts?.icon, tone: opts?.tone },
    ]);
    if (duration > 0) {
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        duration,
      );
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div
        className="toasts"
        aria-live="polite"
        aria-atomic="false"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.tone ?? "default"}`}
            role={t.tone === "danger" ? "alert" : "status"}
          >
            {t.icon && (
              <span className="toast__icon">
                <Icon name={t.icon} size={14} />
              </span>
            )}
            <span className="toast__msg">{t.message}</span>
            <button
              aria-label="Dismiss"
              className="toast__close"
              type="button"
              onClick={() => dismiss(t.id)}
            >
              <Icon name="utility-close" size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
