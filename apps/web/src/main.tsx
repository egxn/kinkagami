import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@kgm/ui/tokens.css";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
