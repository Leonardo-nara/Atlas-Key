import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const directPublicRoutes = new Set([
  "/privacy",
  "/terms",
  "/account-deletion",
  "/support"
]);

if (directPublicRoutes.has(window.location.pathname) && !window.location.hash) {
  window.history.replaceState(null, "", `/#${window.location.pathname}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
