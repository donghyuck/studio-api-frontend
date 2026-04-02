import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export type ConfirmOptions = {
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
};

export type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

// Each queued confirm() call waits here until the current dialog exits.
type QueueEntry = {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  okText: string;
  cancelText: string;
};

const DEFAULT_STATE: ConfirmState = {
  open: false,
  title: "확인",
  message: "",
  okText: "확인",
  cancelText: "취소",
};

// Module-level ref for imperative access outside the React tree
const _ref: { current: ConfirmFn | null } = { current: null };

export const confirm: ConfirmFn = (opts) => {
  if (!_ref.current) return Promise.resolve(false);
  return _ref.current(opts);
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>(DEFAULT_STATE);

  // Pending confirm() calls that arrived while a dialog is already open.
  const queueRef = useRef<QueueEntry[]>([]);
  // Resolver belonging to the dialog currently on screen; null = idle.
  const activeResolveRef = useRef<((ok: boolean) => void) | null>(null);

  // Promote the next queued entry to the active dialog.
  // No-op when a dialog is already active; safe to call at any time.
  const processQueue = useCallback(() => {
    if (activeResolveRef.current !== null) return;

    const next = queueRef.current.shift();
    if (!next) return;

    activeResolveRef.current = next.resolve;
    setState({
      open: true,
      title: next.opts.title ?? "확인",
      message: next.opts.message ?? "",
      okText: next.opts.okText ?? "확인",
      cancelText: next.opts.cancelText ?? "취소",
    });
  }, []);

  const confirmFn = useCallback<ConfirmFn>(
    (opts = {}) =>
      new Promise<boolean>((resolve) => {
        // Push every call to the queue, then immediately try to promote it.
        // If nothing is showing, processQueue opens it right away.
        // If a dialog is open, the entry waits until handleExited fires.
        queueRef.current.push({ opts, resolve });
        processQueue();
      }),
    [processQueue]
  );

  const handleClose = useCallback((ok: boolean) => {
    activeResolveRef.current?.(ok);
    activeResolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
    // processQueue is deferred to handleExited so the exit animation
    // completes before the next dialog opens, preventing visual overlap.
  }, []);

  // Fired by MUI after the exit transition finishes.
  const handleExited = useCallback(() => {
    processQueue();
  }, [processQueue]);

  // Keep module-level singleton in sync with the mounted provider
  _ref.current = confirmFn;

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      <Dialog
        open={state.open}
        onClose={() => handleClose(false)}
        TransitionProps={{ onExited: handleExited }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{state.title}</DialogTitle>
        {state.message ? (
          <DialogContent>
            <DialogContentText>{state.message}</DialogContentText>
          </DialogContent>
        ) : null}
        <DialogActions>
          <Button onClick={() => handleClose(false)}>{state.cancelText}</Button>
          <Button
            onClick={() => handleClose(true)}
            variant="contained"
            autoFocus
          >
            {state.okText}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
