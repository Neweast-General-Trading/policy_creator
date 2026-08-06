import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ViewersApp from "./ViewersApp";
import { AuthProvider } from "@/context/AuthContext";
import { isViewersPath } from "@/lib/viewer-routes";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

const isViewerRoute = isViewersPath();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider authMode={isViewerRoute ? "intranet-only" : "default"}>
        {isViewerRoute ? <ViewersApp /> : <App />}
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
