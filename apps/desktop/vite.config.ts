import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const productionApiUrl = "https://rotapronta-api-production.up.railway.app";
const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src 'self' ${productionApiUrl} wss://rotapronta-api-production.up.railway.app`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

const developmentCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  [
    "connect-src 'self'",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "ws://localhost:3000",
    "ws://127.0.0.1:3000",
    "ws://localhost:5173",
    "ws://127.0.0.1:5173",
    productionApiUrl,
    "wss://rotapronta-api-production.up.railway.app"
  ].join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [
    react(),
    {
      name: "mototake-csp",
      transformIndexHtml(html) {
        return html.replace(
          "__MOTOTAKE_CSP__",
          command === "serve" ? developmentCsp : productionCsp
        );
      },
      generateBundle(_options, bundle) {
        if (command === "serve") {
          return;
        }

        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") {
            continue;
          }

          output.code = output.code.replaceAll(
            "\"http://localhost\"",
            "\"http://\"+\"local\"+\"host\""
          ).replaceAll(
            "\"localhost\"",
            "\"local\"+\"host\""
          );
        }
      }
    }
  ],
  server: {
    port: 5173
  }
}));
