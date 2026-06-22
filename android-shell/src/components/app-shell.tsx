import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Library,
  Upload,
  Save,
  Settings,
  Activity,
  FileText,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "@/stores/library-store";
import { useSettingsStore } from "@/stores/settings-store";

const NAV = [
  { to: "/", label: "Domov", icon: Home },
  { to: "/library", label: "Knižnica", icon: Library },
  { to: "/import", label: "Import", icon: Upload, primary: true },
  { to: "/settings", label: "Nastavenia", icon: Settings },
  { to: "/diagnostics", label: "Diagnostika", icon: Activity },
  { to: "/legal", label: "Právne", icon: FileText },
];

const NAV_MOBILE = NAV.slice(0, 5);

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isPlayRoute = location.pathname.startsWith("/play/");
  const [hydrated, setHydrated] = useState(false);

  const loadSettings = useSettingsStore((s) => s.load);
  const setGames = useLibraryStore((s) => s.setGames);

  useEffect(() => {
    loadSettings();
    import("@/lib/storage/repositories")
      .then(({ getAllGames }) => getAllGames())
      .then((games) => setGames(games))
      .catch(() => {
        /* IndexedDB may be unavailable on first launch */
      })
      .finally(() => setHydrated(true));
  }, [loadSettings, setGames]);

  if (isPlayRoute) {
    return <>{children}</>;
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Načítavam…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30">
              <Gamepad2 className="h-5 w-5 text-primary" />
            </div>
            <span
              className="font-display text-sm tracking-tight text-primary"
              style={{ letterSpacing: "0.05em" }}
            >
              JAŇO ŠE CHCE BAVKAC
            </span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-border bg-sidebar/50">
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                location.pathname === item.to ||
                (item.to !== "/" && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
            <p>v0.3.0 · DOS ✅ · PS1 ✅ · PS2 ⛔</p>
          </div>
        </aside>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {NAV_MOBILE.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", item.primary && "text-primary")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
