import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getSuperAdminSession } from "@/lib/super-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

const authSearchSchema = z.object({
  denied: z.boolean().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Super Admin · Acceso" },
      { name: "description", content: "Acceso al panel del super administrador." },
    ],
  }),
  beforeLoad: async () => {
    const { isSuperAdmin } = await getSuperAdminSession();
    if (isSuperAdmin) throw redirect({ to: "/super-admin" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { isSuperAdmin } = await getSuperAdminSession();
      if (!isSuperAdmin) {
        await supabase.auth.signOut();
        toast.error("Esta cuenta no tiene rol de super administrador.");
        return;
      }
      navigate({ to: "/super-admin" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[oklch(0.97_0.02_80)] px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-foreground text-background shadow-lg">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight">Super Admin</h1>
        <p className="text-sm text-muted-foreground">Panel de control global</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-3xl border bg-background p-6 shadow-sm"
      >
        {denied && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Tu sesión no tiene permiso para entrar al panel. Iniciá sesión con una cuenta super
            administrador.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="rounded-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="rounded-full"
          />
        </div>

        <Button type="submit" disabled={loading} className="h-12 w-full rounded-full font-semibold">
          {loading ? "Ingresando…" : "Ingresar"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Las cuentas de super administrador se crean desde Supabase. Este panel no permite
          registro.
        </p>
      </form>
    </div>
  );
}
