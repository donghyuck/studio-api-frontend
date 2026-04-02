import { ConfirmProvider } from "@/react/feedback/ConfirmProvider";
import { ToastProvider } from "@/react/feedback/ToastProvider";

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
