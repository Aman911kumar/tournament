import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initFrontendMonitoring } from "@/lib/frontend-monitoring";

initFrontendMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
