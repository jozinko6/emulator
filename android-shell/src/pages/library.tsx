import { Link } from "react-router-dom";
import { Upload, Gamepad2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLibraryStore } from "@/stores/library-store";

const PLATFORM_LABEL: Record<string, string> = {
  dos: "DOS",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
};
const PLATFORM_COLOR: Record<string, string> = {
  dos: "text-amber-400",
  ps1: "text-emerald-400",
  ps2: "text-fuchsia-400",
};

export function LibraryPage() {
  const games = useLibraryStore((s) => s.games);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg text-primary">Knižnica</h1>
        <Link to="/import">
          <Button size="sm">
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
        </Link>
      </div>

      {games.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Knižnica je prázdna. Importujte prvú hru.
          </p>
          <Link to="/import">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Importovať hru
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {games.map((g) => (
            <Link key={g.id} to={`/game/${g.id}`} className="group no-underline">
              <Card className="overflow-hidden bg-card hover:ring-1 hover:ring-primary/40 transition-all h-full">
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
      )}
    </div>
  );
}
