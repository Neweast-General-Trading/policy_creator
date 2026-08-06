import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ViewersApp from "./ViewersApp";
import { AuthProvider } from "@/context/AuthContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider authMode="intranet-only">
        <ViewersApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
