"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  Upload,
  Save,
  Settings,
  Activity,
  FileText,
  Gamepad2,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useLibraryStore } from "@/stores/library-store";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { InstallPrompt } from "@/components/pwa/install-prompt";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
}

const NAV_DESKTOP: NavItem[] = [
  { href: "/", label: "Domov", icon: Home },
  { href: "/library", label: "Knižnica", icon: Library },
  { href: "/import", label: "Importovať", icon: Upload, primary: true },
  { href: "/saves", label: "Save States", icon: Save },
  { href: "/diagnostics", label: "Diagnostika", icon: Activity },
  { href: "/settings", label: "Nastavenia", icon: Settings },
  { href: "/legal", label: "Právne", icon: FileText },
];

const NAV_MOBILE: NavItem[] = [
  { href: "/", label: "Domov", icon: Home },
  { href: "/library", label: "Knižnica", icon: Library },
  { href: "/import", label: "Import", icon: Upload, primary: true },
  { href: "/saves", label: "Saves", icon: Save },
  { href: "/settings", label: "Nastav.", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const loadSettings = useSettingsStore((s) => s.load);
  const loadGames = useLibraryStore((s) => s.setGames);

  useEffect(() => {
    loadSettings();
    // Hydrate library from IndexedDB
    import("@/lib/storage/repositories")
      .then(({ getAllGames }) => getAllGames())
      .then((games) => loadGames(games))
      .catch(() => {
        // IndexedDB may be unavailable
      });
  }, [loadSettings, loadGames]);

  // Play route is fullscreen — no chrome
  const isPlayRoute = pathname.startsWith("/play/");
  if (isPlayRoute) {
    return (
      <>
        {children}
        <ServiceWorkerRegistrar />
        <InstallPrompt />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top brand bar (mobile + desktop) */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 no-underline">
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
          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Cloud className="h-3.5 w-3.5" />
            <span>Lokálne úložisko · Hry sa neodosielajú na server</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-border bg-sidebar/50">
          <nav className="flex-1 p-3 space-y-1">
            {NAV_DESKTOP.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm no-underline transition-colors",
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
            <p>v0.1.0 · DOS ✅ · PS1 ✅ · PS2 ⛔</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav — max 5 items per prompt */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="grid grid-cols-5"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {NAV_MOBILE.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] no-underline",
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

      <ServiceWorkerRegistrar />
      <InstallPrompt />
    </div>
  );
}
