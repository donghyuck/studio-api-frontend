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
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmFn = useCallback<ConfirmFn>((opts = {}) => {
    setState({
      open: true,
      title: opts.title ?? "확인",
      message: opts.message ?? "",
      okText: opts.okText ?? "확인",
      cancelText: opts.cancelText ?? "취소",
    });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  // Keep module-level singleton in sync with the mounted provider
  _ref.current = confirmFn;

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      <Dialog
        open={state.open}
        onClose={() => handleClose(false)}
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
