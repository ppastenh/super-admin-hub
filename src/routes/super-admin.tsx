import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  LogIn,
  ShieldCheck,
  Check,
  X,
  Users,
  Building2,
  Clock,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSuperAdminSession } from "@/lib/super-admin";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Super Admin · Panel General" },
      {
        name: "description",
        content:
          "Panel de control del super administrador: gestión global de boxes, aprobaciones y permisos.",
      },
      { property: "og:title", content: "Super Admin · Panel General" },
      { property: "og:description", content: "Gestión global de boxes, aprobaciones y permisos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { session, isSuperAdmin } = await getSuperAdminSession();
    if (!session) throw redirect({ to: "/auth" });
    if (!isSuperAdmin) throw redirect({ to: "/auth", search: { denied: true } });
    return { email: session.user.email ?? "" };
  },
  component: SuperAdminPanel,
});

type PendingBox = {
  id: string;
  name: string;
  location: string | null;
  owner_user_id: string | null;
  ownerEmail: string | null;
};
type ActiveBox = { id: string; name: string; status: "activo" | "suspendido" };

async function fetchPending(): Promise<PendingBox[]> {
  const { data, error } = await supabase
    .from("boxes")
    .select("id, name, location, owner_user_id")
    .eq("status", "pendiente")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter((v): v is string => !!v))];
  let emailById = new Map<string, string | null>();
  if (ownerIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", ownerIds);
    if (pErr) throw pErr;
    emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));
  }

  return rows.map((r) => ({
    ...r,
    ownerEmail: r.owner_user_id ? (emailById.get(r.owner_user_id) ?? null) : null,
  }));
}

async function fetchActive(): Promise<ActiveBox[]> {
  const { data, error } = await supabase
    .from("boxes")
    .select("id, name, status")
    .in("status", ["activo", "suspendido"])
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status as ActiveBox["status"],
  }));
}

async function fetchStudentCount(): Promise<number | null> {
  const { count, error } = await supabase
    .from("box_members")
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

/** Crea user_roles(role='box_admin', box_id, user_id) si todavía no existe. */
async function ensureBoxAdminRole(boxId: string, userId: string) {
  const { data: existing, error: selErr } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "box_admin")
    .eq("box_id", boxId)
    .limit(1);
  if (selErr) throw selErr;
  if ((existing?.length ?? 0) > 0) return;

  const { error: insErr } = await supabase
    .from("user_roles")
    .insert({ role: "box_admin", box_id: boxId, user_id: userId });
  if (insErr) throw insErr;
}

function SuperAdminPanel() {
  const { email } = Route.useRouteContext();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["boxes"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const pendingQ = useQuery({ queryKey: ["boxes", "pendiente"], queryFn: fetchPending });
  const activeQ = useQuery({ queryKey: ["boxes", "active"], queryFn: fetchActive });
  const studentsQ = useQuery({ queryKey: ["students", "count"], queryFn: fetchStudentCount });

  const pending = pendingQ.data ?? [];
  const active = activeQ.data ?? [];

  const [userQuery, setUserQuery] = useState("");
  const [grantBoxId, setGrantBoxId] = useState("");

  const approve = useMutation({
    mutationFn: async (b: PendingBox) => {
      if (!b.owner_user_id) {
        throw new Error("Este box no tiene una cuenta dueña asignada; no se puede aprobar.");
      }
      // El rol primero: si falla, no dejamos el box en 'activo' sin box_admin.
      await ensureBoxAdminRole(b.id, b.owner_user_id);
      const { error } = await supabase.from("boxes").update({ status: "activo" }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: (_d, b) => {
      toast.success(`${b.name} aprobado`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo aprobar"),
  });

  const reject = useMutation({
    mutationFn: async (b: PendingBox) => {
      const { error } = await supabase.from("boxes").update({ status: "rechazado" }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: (_d, b) => {
      toast(`${b.name} rechazado`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo rechazar"),
  });

  const grant = useMutation({
    mutationFn: async ({ email: rawEmail, boxId }: { email: string; boxId: string }) => {
      const clean = rawEmail.trim();
      if (!clean) throw new Error("Ingresá un email.");
      if (!boxId) throw new Error("Elegí un box.");

      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", clean)
        .limit(2);
      if (error) throw error;
      if (!profs || profs.length === 0)
        throw new Error(`No hay ninguna cuenta con el email "${clean}".`);
      if (profs.length > 1) throw new Error("Hay más de una cuenta con ese email.");

      await ensureBoxAdminRole(boxId, profs[0].id);
      return { email: profs[0].email ?? clean };
    },
    onSuccess: ({ email: grantedTo }) => {
      toast.success(`Rol de Admin de Box otorgado a ${grantedTo}`);
      setUserQuery("");
      setGrantBoxId("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo otorgar el rol"),
  });

  const impersonate = (b: ActiveBox, as: "admin" | "alumno") => {
    toast.success(`Entrando como ${as} en ${b.name}`);
  };

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const activeCount = active.filter((a) => a.status === "activo").length;

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.02_80)] px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="h-10 w-32 rounded-full bg-background border" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
            <div className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium">
              Super Admin
            </div>
          </div>
        </div>

        {(pendingQ.isError || activeQ.isError) && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            No se pudieron cargar los boxes: {String((pendingQ.error ?? activeQ.error) as Error)}
          </div>
        )}

        {/* Panel General card */}
        <section className="rounded-3xl border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">Panel General</h1>
            <Badge className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              SUPER ADMIN
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat
              icon={<Building2 className="h-4 w-4" />}
              value={activeQ.isLoading ? "…" : activeCount}
              label="Boxes activos"
              tone="foreground"
            />
            <Stat
              icon={<Clock className="h-4 w-4" />}
              value={pendingQ.isLoading ? "…" : pending.length}
              label="Pendientes"
              tone="primary"
            />
            <Stat
              icon={<Users className="h-4 w-4" />}
              value={studentsQ.isLoading ? "…" : (studentsQ.data ?? "—")}
              label="Alumnos totales"
              tone="foreground"
            />
          </div>
        </section>

        {/* Boxes por aprobar */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Boxes por aprobar</h2>
          {pendingQ.isLoading ? (
            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              Cargando…
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              No hay boxes pendientes.
            </div>
          ) : (
            pending.map((b) => {
              const busy = approve.isPending || reject.isPending;
              return (
                <div key={b.id} className="rounded-2xl border bg-background p-4">
                  <div className="font-semibold">{b.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {b.ownerEmail ?? (b.owner_user_id ? "dueño sin perfil" : "sin dueño asignado")}
                    {b.location ? ` · ${b.location}` : ""}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => approve.mutate(b)}
                      disabled={busy || !b.owner_user_id}
                      className="rounded-full bg-foreground text-background hover:bg-foreground/90"
                    >
                      <Check className="h-4 w-4" /> Aprobar
                    </Button>
                    <Button
                      onClick={() => reject.mutate(b)}
                      disabled={busy}
                      variant="outline"
                      className="rounded-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Otorgar permiso */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Otorgar permiso</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              grant.mutate({ email: userQuery, boxId: grantBoxId });
            }}
            className="rounded-2xl border bg-background p-4 space-y-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Email de la cuenta"
                type="email"
                className="pl-9 rounded-full"
              />
            </div>
            <select
              value={grantBoxId}
              onChange={(e) => setGrantBoxId(e.target.value)}
              className="w-full rounded-full border bg-background px-4 py-2 text-sm"
            >
              <option value="">Elegí un box…</option>
              {active.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              disabled={grant.isPending || !userQuery.trim() || !grantBoxId}
              className="w-full rounded-full"
            >
              <ShieldCheck className="h-4 w-4" /> Dar rol de Admin de Box
            </Button>
          </form>
        </section>

        {/* Boxes activos */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Boxes activos</h2>
          {activeQ.isLoading ? (
            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              Cargando…
            </div>
          ) : active.length === 0 ? (
            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              No hay boxes activos.
            </div>
          ) : (
            active.map((b) => (
              <div key={b.id} className="rounded-2xl border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{b.name}</div>
                  <Badge
                    variant="secondary"
                    className={
                      b.status === "activo"
                        ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100"
                    }
                  >
                    {b.status === "activo" ? "Activo" : "Suspendido"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => impersonate(b, "admin")}
                    variant="outline"
                    className="rounded-full"
                  >
                    <LogIn className="h-4 w-4" /> Entrar como admin
                  </Button>
                  <Button
                    onClick={() => impersonate(b, "alumno")}
                    variant="outline"
                    className="rounded-full"
                  >
                    <LogIn className="h-4 w-4" /> Entrar como alumno
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tone: "foreground" | "primary";
}) {
  return (
    <div className="rounded-2xl border bg-background p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <div
        className={`mt-1 text-3xl font-bold ${tone === "primary" ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}
