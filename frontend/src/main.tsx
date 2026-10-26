import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerNotificationWorker } from "./lib/browserNotifications";
import "./index.css";

// Registers the notification worker early, so the first inbox message can use
// it. The worker has no fetch handler and never caches app assets.
registerNotificationWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
