import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { Terminal } from "./pages/Terminal";
import { SaaS } from "./pages/SaaS";

const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

function Nav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        gap: 2,
        padding: "4px 6px",
        borderRadius: 999,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(12px)",
        fontFamily: SANS,
        fontSize: 12,
        letterSpacing: 0.3,
      }}
    >
      {[
        { to: "/terminal", label: "05 · Terminal" },
        { to: "/saas", label: "03 · SaaS" },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            padding: "5px 14px",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: isActive ? 600 : 400,
            background: isActive ? "#fff" : "transparent",
            color: isActive ? "#111" : "rgba(255,255,255,.75)",
            transition: "background .15s, color .15s",
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const [termDark, setTermDark] = useState(true);
  const [saasDark, setSaasDark] = useState(false);

  return (
    <BrowserRouter>
      <Nav />
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
        <Routes>
          <Route index element={<Navigate to="/terminal" replace />} />
          <Route
            path="/terminal"
            element={
              <Terminal
                dark={termDark}
                onToggleDark={() => setTermDark((d) => !d)}
              />
            }
          />
          <Route
            path="/saas"
            element={
              <SaaS
                dark={saasDark}
                onToggleDark={() => setSaasDark((d) => !d)}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
