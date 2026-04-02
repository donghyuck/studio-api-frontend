import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Alert, Snackbar } from "@mui/material";

export type ToastSeverity = "success" | "info" | "warning" | "error";

export type ToastOptions = {
  severity?: ToastSeverity;
  timeout?: number;
};

export type ToastApi = {
  show: (message: string, opts?: ToastOptions) => void;
  success: (message: string, opts?: Omit<ToastOptions, "severity">) => void;
  info: (message: string, opts?: Omit<ToastOptions, "severity">) => void;
  warning: (message: string, opts?: Omit<ToastOptions, "severity">) => void;
  error: (message: string, opts?: Omit<ToastOptions, "severity">) => void;
  close: () => void;
};

type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
  timeout: number;
  // key increments on every show() so React unmounts the previous Snackbar
  // instance and mounts a new one, guaranteeing autoHideDuration always
  // starts from zero regardless of whether a previous toast was still open.
  key: number;
};

// Module-level ref for imperative access outside the React tree
// (e.g. Axios interceptors, Zustand store actions)
const _ref: { current: ToastApi | null } = { current: null };

export const toast: ToastApi = {
  show: (m, o) => _ref.current?.show(m, o),
  success: (m, o) => _ref.current?.success(m, o),
  info: (m, o) => _ref.current?.info(m, o),
  warning: (m, o) => _ref.current?.warning(m, o),
  error: (m, o) => _ref.current?.error(m, o),
  close: () => _ref.current?.close(),
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
    timeout: 2500,
    key: 0,
  });

  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    setState((prev) => ({
      open: true,
      message,
      severity: opts.severity ?? "success",
      timeout: opts.timeout ?? 2500,
      // Increment key to force a fresh Snackbar mount with a clean timer.
      key: prev.key + 1,
    }));
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, { ...o, severity: "success" }),
      info: (m, o) => show(m, { ...o, severity: "info" }),
      warning: (m, o) => show(m, { ...o, severity: "warning" }),
      error: (m, o) => show(m, { ...o, severity: "error" }),
      close,
    }),
    [show, close]
  );

  // Keep module-level singleton in sync with the mounted provider
  _ref.current = api;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={state.key}
        open={state.open}
        autoHideDuration={state.timeout}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={close}
          severity={state.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
