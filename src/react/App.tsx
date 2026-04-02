import { BrowserRouter } from "react-router-dom";
import { AuthBootstrapGate } from "@/react/auth/AuthBootstrapGate";
import { AppRouter } from "@/react/router/AppRouter";

export function App() {
  return (
    <BrowserRouter>
      <AuthBootstrapGate>
        <AppRouter />
      </AuthBootstrapGate>
    </BrowserRouter>
  );
}
