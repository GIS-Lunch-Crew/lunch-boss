import React from "react";
import { createRoot } from "react-dom/client";
import WheelApp from "./WheelApp.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WheelApp />
  </React.StrictMode>,
);
