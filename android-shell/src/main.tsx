import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@shell/components/app-shell";
import { HomePage } from "@shell/pages/home";
import { LibraryPage } from "@shell/pages/library";
import { ImportPage } from "@shell/pages/import";
import { GameDetailPage } from "@shell/pages/game-detail";
import { PlayPage } from "@shell/pages/play";
import { SettingsPage } from "@shell/pages/settings";
import { DiagnosticsPage } from "@shell/pages/diagnostics";
import { LegalPage } from "@shell/pages/legal";
import "@/app/globals.css";

// Suppress unused import warning — StrictMode is intentional
void StrictMode;

function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/game/:id" element={<GameDetailPage />} />
          <Route path="/play/:id" element={<PlayPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
