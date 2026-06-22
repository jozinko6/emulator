"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Play,
  Heart,
  Clock,
  Gamepad2,
  HardDrive,
  Cpu,
  AlertCircle,
  Smartphone,
  Monitor,
  Tv,
  Keyboard,
  Usb,
  Bluetooth,
  Download,
} from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StorageMeter } from "@/components/pwa/storage-meter";
import { AndroidDownloadSection } from "@/components/pwa/android-download-section";
import { getRuntimeInfo, type RuntimeInfo } from "@/lib/native/native-platform";
import type { GameRecord } from "@/types/game";
import type { EmulatorPlatform } from "@/types/emulator";

const PLATFORM_LABEL: Record<EmulatorPlatform, string> = {
  dos: "DOS",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
};

const PLATFORM_COLOR: Record<EmulatorPlatform, string> = {
  dos: "text-amber-400",
  ps1: "text-emerald-400",
  ps2: "text-fuchsia-400",
};

export default function HomePage() {
  const games = useLibraryStore((s) => s.games);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);

  useEffect(() => {
    setRuntime(getRuntimeInfo());
  }, []);

  const continuePlaying = games
    .filter((g) => g.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 1)[0];

  const recent = [...games]
    .filter((g) => g.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 6);

  const favorites = games.filter((g) => g.isFavorite).slice(0, 6);

  const byPlatform = (p: EmulatorPlatform) =>
    games.filter((g) => g.platform === p).slice(0, 6);

  const ps2Enabled = process.env.NEXT_PUBLIC_ENABLE_PS2 === "true";
  const isEmpty = games.length === 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-7xl">
      {/* Hero */}
      {isEmpty ? (
        <Card className="border-dashed border-2 border-border bg-card/50 p-8 md:p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Gamepad2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-primary mb-2 tracking-tight">
            JAŇO ŠE CHCE BAVKAC
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm md:text-base">
            Zahraj si svoje DOS a PlayStation hry na počítači, mobile, tablete
            alebo Android TV. Hry zostávajú vo vašom zariadení — nikdy sa
            neodosielajú na server.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild>
              <Link href="/library">
                <Play className="h-4 w-4 mr-2" />
                Otvoriť emulátor
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">
                <Upload className="h-4 w-4 mr-2" />
                Importovať hru
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="#download-android">
                <Download className="h-4 w-4 mr-2" />
                Stiahnuť Android aplikáciu
              </a>
            </Button>
          </div>
        </Card>
      ) : (
        <section>
          <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Pokračovať v hraní
          </h2>
          {continuePlaying ? (
            <Card className="bg-gradient-to-br from-card to-card/50 p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <div className={`text-sm font-medium ${PLATFORM_COLOR[continuePlaying.platform]}`}>
                  {PLATFORM_LABEL[continuePlaying.platform]}
                </div>
                <h3 className="text-2xl font-semibold mt-1">{continuePlaying.name}</h3>
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Naposledy hrané:{" "}
                  {new Date(continuePlaying.lastPlayedAt ?? 0).toLocaleDateString("sk")}
                </p>
              </div>
              <Button asChild size="lg">
                <Link href={`/play/${continuePlaying.id}`}>
                  <Play className="h-4 w-4 mr-2" />
                  Hrať
                </Link>
              </Button>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Žiadna nedávno hraná hra.</p>
          )}
        </section>
      )}

      {/* Supported devices section */}
      <section>
        <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Podporované zariadenia
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <DeviceTile icon={Monitor} label="PC a notebook" sub="Windows · Linux · macOS" />
          <DeviceTile icon={Smartphone} label="Android telefón" sub="Tablet aj mobil" />
          <DeviceTile icon={Tv} label="Android TV" sub="Google TV · TV box" />
          <DeviceTile icon={Gamepad2} label="Gamepad" sub="USB · Bluetooth" />
          <DeviceTile icon={Keyboard} label="Klávesnica + myš" sub="Plná podpora na PC" />
          <DeviceTile icon={Usb} label="USB kľúč" sub="Import z disku" />
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link href="/import">
            <Upload className="h-5 w-5" />
            <span className="text-xs">Rýchly import</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link href="/library">
            <Gamepad2 className="h-5 w-5" />
            <span className="text-xs">Knižnica</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link href="/saves">
            <HardDrive className="h-5 w-5" />
            <span className="text-xs">Save States</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link href="/diagnostics">
            <Cpu className="h-5 w-5" />
            <span className="text-xs">Diagnostika</span>
          </Link>
        </Button>
      </section>

      {/* Recent + Favorites + platform sections */}
      {recent.length > 0 && (
        <section>
          <SectionHeader title="Nedávno hrané" icon={Clock} href="/library" />
          <GameRow games={recent} />
        </section>
      )}

      {favorites.length > 0 && (
        <section>
          <SectionHeader title="Obľúbené" icon={Heart} href="/library" />
          <GameRow games={favorites} />
        </section>
      )}

      <section>
        <SectionHeader title="DOS" icon={Gamepad2} href="/library?platform=dos" accent="text-amber-400" />
        {byPlatform("dos").length > 0 ? (
          <GameRow games={byPlatform("dos")} />
        ) : (
          <EmptyPlatform label="Žiadne DOS hry. Importujte .jsdos, ZIP alebo .bat súbor." />
        )}
      </section>

      <section>
        <SectionHeader title="PlayStation" icon={Gamepad2} href="/library?platform=ps1" accent="text-emerald-400" />
        {byPlatform("ps1").length > 0 ? (
          <GameRow games={byPlatform("ps1")} />
        ) : (
          <EmptyPlatform label="Žiadne PS1 hry. Importujte BIN+CUE, CHD alebo PBP." />
        )}
      </section>

      <section>
        <SectionHeader
          title="PlayStation 2"
          icon={Gamepad2}
          href="/library?platform=ps2"
          accent="text-fuchsia-400"
          badge={ps2Enabled ? "EXPERIMENTÁLNE" : "VYPNUTÉ"}
        />
        {!ps2Enabled ? (
          <Card className="border-fuchsia-500/30 bg-fuchsia-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-fuchsia-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-fuchsia-300">
                  PS2 emulačné jadro zatiaľ nie je v tomto zostavení dostupné.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PS2 emulácia je experimentálna a v predvolenom zostavení vypnutá
                  (NEXT_PUBLIC_ENABLE_PS2=false).
                </p>
              </div>
            </div>
          </Card>
        ) : byPlatform("ps2").length > 0 ? (
          <GameRow games={byPlatform("ps2")} />
        ) : (
          <EmptyPlatform label="Žiadne PS2 hry." />
        )}
      </section>

      {/* Android download section */}
      <section id="download-android">
        <SectionHeader title="Stiahnuť aplikáciu" icon={Download} />
        <AndroidDownloadSection />
        <Card className="mt-3 p-4 bg-card/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Android aplikácia funguje:</strong>{" "}
            na telefónoch, na tabletoch, na Android TV a Google TV.
            Podporuje USB a Bluetooth gamepady, umožňuje import z USB kľúča
            cez Storage Access Framework, funguje offline po prvom načítaní.
            Hry zostávajú lokálne v app-specific storage — nikdy sa neodosielajú na server.
          </p>
          {runtime && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Detekované prostredie:{" "}
              <span className="font-mono text-foreground/70">{runtime.platform}</span>
            </p>
          )}
        </Card>
      </section>

      {/* Storage status */}
      <section>
        <SectionHeader title="Stav lokálneho úložiska" icon={HardDrive} />
        <Card className="p-4">
          <StorageMeter />
        </Card>
      </section>
    </div>
  );
}

function DeviceTile({
  icon: Icon,
  label,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <Card className="p-3 text-center bg-card/50">
      <Icon className="h-6 w-6 mx-auto text-primary mb-2" />
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  href,
  accent = "text-primary",
  badge,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {title}
        {badge && (
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30">
            {badge}
          </span>
        )}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
          Zobraziť všetky →
        </Link>
      )}
    </div>
  );
}

function GameRow({ games }: { games: GameRecord[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {games.map((g) => (
        <Link key={g.id} href={`/game/${g.id}`} className="group no-underline">
          <Card className="overflow-hidden bg-card hover:ring-1 hover:ring-primary/40 transition-all">
            <div className="aspect-[3/4] bg-gradient-to-br from-primary/10 to-fuchsia-500/5 flex items-center justify-center">
              {g.coverUrl ? (
                <img src={g.coverUrl} alt={g.name} className="w-full h-full object-cover" />
              ) : (
                <Gamepad2 className="h-8 w-8 text-primary/30" />
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate">{g.name}</p>
              <p className={`text-[10px] ${PLATFORM_COLOR[g.platform]}`}>
                {PLATFORM_LABEL[g.platform]}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function EmptyPlatform({ label }: { label: string }) {
  return (
    <Card className="border-dashed border-border p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
