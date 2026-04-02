import { BrowserRouter } from "react-router-dom";
import { AuthBootstrapGate } from "@/react/auth/AuthBootstrapGate";
import { FeedbackProvider } from "@/react/feedback";
import { AppRouter } from "@/react/router/AppRouter";

export function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthBootstrapGate>
          <AppRouter />
        </AuthBootstrapGate>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
