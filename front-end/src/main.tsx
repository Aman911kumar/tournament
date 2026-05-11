import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";
import { initFrontendMonitoring } from "@/lib/frontend-monitoring";

initFrontendMonitoring();

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY. Add your Clerk publishable key to front-end/.env.");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={clerkPublishableKey}
    signInUrl="/login"
    signUpUrl="/login"
    signInFallbackRedirectUrl="/"
    signUpFallbackRedirectUrl="/"
    afterSignOutUrl="/login"
  >
    <App />
  </ClerkProvider>,
);
