import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
    if (command === "build" && mode !== "development") {
        const env = loadEnv(mode, process.cwd(), "VITE_");
        const VITE_BASE_URL = env.VITE_BASE_URL || "https://orbivo-e-commerce-platform-backend.onrender.com";
        let backendUrl: URL;
        try {
            backendUrl = new URL(VITE_BASE_URL);
        } catch {
            throw new Error("Set VITE_BASE_URL to the deployed HTTPS backend URL in the build environment");
        }
        const hostname = backendUrl.hostname.toLowerCase().replace(/\.$/, "");
        if (
            backendUrl.protocol !== "https:" ||
            hostname === "localhost" || hostname.endsWith(".localhost") ||
            hostname.startsWith("127.") || hostname === "[::1]" ||
            hostname === "0.0.0.0"
        ) {
            throw new Error("VITE_BASE_URL must use the deployed HTTPS backend, not localhost");
        }
    }
    return { plugins: [react(), tailwindcss()] };
});
