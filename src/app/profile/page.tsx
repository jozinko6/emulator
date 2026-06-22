"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { Mail, Lock, LogOut, Cloud, CloudOff } from "lucide-react";

export default function ProfilePage() {
  const { session, loading, supabaseEnabled, load, signOut } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    load();
  }, [load]);

  if (!supabaseEnabled) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-md">
        <Card className="p-6 text-center">
          <CloudOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="font-display text-base text-primary mb-2">Účet nie je dostupný</h1>
          <p className="text-sm text-muted-foreground">
            Supabase nie je nakonfigurovaný v tomto zostavení. Aplikácia funguje
            úplne bez účtu — všetky vaše hry a nastavenia zostávajú v zariadení.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-md">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Načítavam…</p>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-md space-y-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <h1 className="font-display text-base text-primary">Prihlásenie</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Voliteľné — pre synchronizáciu metadát medzi zariadeniami.
            Hry a BIOS sa nikdy nesynchronizujú.
          </p>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder="meno@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Heslo</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={async () => {
                const { getSupabaseClient } = await import("@/lib/supabase/client");
                const supabase = getSupabaseClient();
                if (!supabase) return;
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) alert(error.message);
                else await load();
              }}
            >
              Prihlásiť sa
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { getSupabaseClient } = await import("@/lib/supabase/client");
                const supabase = getSupabaseClient();
                if (!supabase) return;
                const { error } = await supabase.auth.signInWithOtp({ email });
                if (error) alert(error.message);
                else alert("Magic link bol odoslaný na " + email);
              }}
            >
              Poslať magic link
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { getSupabaseClient } = await import("@/lib/supabase/client");
                const supabase = getSupabaseClient();
                if (!supabase) return;
                const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google" });
                if (error) alert(error.message);
                if (data?.url) window.location.href = data.url;
              }}
            >
              Pokračovať s Google
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-md space-y-4">
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <h1 className="font-display text-base text-primary">Prihlásený</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Email: <span className="font-mono text-foreground">{session.email}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Synchronizácia metadát hier, nastavení a save states prebieha automaticky.
          Hry a BIOS zostávajú v zariadení.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" />
          Odhlásiť sa
        </Button>
      </Card>
    </div>
  );
}
