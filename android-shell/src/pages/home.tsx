import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLibraryStore } from "@/stores/library-store";
import { StorageMeter } from "@shell/components/storage-meter";
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

export function HomePage() {
  const games = useLibraryStore((s) => s.games);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);

  useEffect(() => {
    setRuntime(getRuntimeInfo());
  }, []);

  const continuePlaying = games
    .filter((g) => g.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 1)[0];

  const isEmpty = games.length === 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 max-w-7xl">
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
            <Link to="/library">
              <Button size="lg">
                <Play className="h-4 w-4 mr-2" />
                Otvoriť emulátor
              </Button>
            </Link>
            <Link to="/import">
              <Button variant="outline" size="lg">
                <Upload className="h-4 w-4 mr-2" />
                Importovať hru
              </Button>
            </Link>
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
              <Link to={`/play/${continuePlaying.id}`}>
                <Button size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Pokračovať
                </Button>
              </Link>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Žiadna nedávno hraná hra.</p>
          )}
        </section>
      )}

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

      <section>
        <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Stav lokálneho úložiska
        </h2>
        <Card className="p-4">
          <StorageMeter />
        </Card>
      </section>

      {runtime && (
        <section>
          <Card className="p-3 bg-card/30">
            <p className="text-[10px] text-muted-foreground">
              Detekované prostredie:{" "}
              <span className="font-mono text-foreground/70">{runtime.platform}</span>
            </p>
          </Card>
        </section>
      )}
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
