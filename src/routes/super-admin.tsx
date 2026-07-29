import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, LogIn, ShieldCheck, Check, X, Users, Building2, Clock } from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin · Panel General" },
      { name: "description", content: "Panel de control del super administrador: gestión global de boxes, aprobaciones y permisos." },
      { property: "og:title", content: "Super Admin · Panel General" },
      { property: "og:description", content: "Gestión global de boxes, aprobaciones y permisos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuperAdminPanel,
});

type PendingBox = { id: string; name: string; owner: string; location: string };
type ActiveBox = { id: string; name: string; status: "Activo" | "Suspendido" };

const INITIAL_PENDING: PendingBox[] = [
  { id: "p1", name: "Box Fuerza Sur", owner: "Camila R.", location: "Ñuñoa" },
  { id: "p2", name: "Iron Athletics", owner: "Diego M.", location: "Providencia" },
];

const INITIAL_ACTIVE: ActiveBox[] = [
  { id: "a1", name: "Box Titán", status: "Activo" },
  { id: "a2", name: "Wodplace Maipú", status: "Activo" },
  { id: "a3", name: "CrossBox Las Condes", status: "Activo" },
  { id: "a4", name: "Forge Athletic", status: "Suspendido" },
];

function SuperAdminPanel() {
  const [pending, setPending] = useState<PendingBox[]>(INITIAL_PENDING);
  const [active, setActive] = useState<ActiveBox[]>(INITIAL_ACTIVE);
  const [totalAlumnos] = useState(340);
  const [userQuery, setUserQuery] = useState("");

  const approve = (b: PendingBox) => {
    setPending((p) => p.filter((x) => x.id !== b.id));
    setActive((a) => [...a, { id: b.id, name: b.name, status: "Activo" }]);
    toast.success(`${b.name} aprobado`);
  };
  const reject = (b: PendingBox) => {
    setPending((p) => p.filter((x) => x.id !== b.id));
    toast(`${b.name} rechazado`);
  };
  const impersonate = (b: ActiveBox, as: "admin" | "alumno") => {
    toast.success(`Entrando como ${as} en ${b.name}`);
  };
  const grantRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    toast.success(`Rol de Admin de Box otorgado a ${userQuery}`);
    setUserQuery("");
  };

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.02_80)] px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="h-10 w-32 rounded-full bg-background border" />
          <div className="rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium">
            Super Admin
          </div>
        </div>

        {/* Panel General card */}
        <section className="rounded-3xl border bg-background p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">Panel General</h1>
            <Badge className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              SUPER ADMIN
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat icon={<Building2 className="h-4 w-4" />} value={active.filter(a => a.status === "Activo").length} label="Boxes activos" tone="foreground" />
            <Stat icon={<Clock className="h-4 w-4" />} value={pending.length} label="Pendientes" tone="primary" />
            <Stat icon={<Users className="h-4 w-4" />} value={totalAlumnos} label="Alumnos totales" tone="foreground" />
          </div>
        </section>

        {/* Boxes por aprobar */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Boxes por aprobar</h2>
          {pending.length === 0 ? (
            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              No hay boxes pendientes.
            </div>
          ) : (
            pending.map((b) => (
              <div key={b.id} className="rounded-2xl border bg-background p-4">
                <div className="font-semibold">{b.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {b.owner} · {b.location}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => approve(b)} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                    <Check className="h-4 w-4" /> Aprobar
                  </Button>
                  <Button onClick={() => reject(b)} variant="outline" className="rounded-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" /> Rechazar
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Otorgar permiso */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Otorgar permiso</h2>
          <form onSubmit={grantRole} className="rounded-2xl border bg-background p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Buscar usuario por email o nombre"
                className="pl-9 rounded-full"
              />
            </div>
            <Button type="submit" className="w-full rounded-full">
              <ShieldCheck className="h-4 w-4" /> Dar rol de Admin de Box
            </Button>
          </form>
        </section>

        {/* Boxes activos */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Boxes activos</h2>
          {active.map((b) => (
            <div key={b.id} className="rounded-2xl border bg-background p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{b.name}</div>
                <Badge
                  variant="secondary"
                  className={
                    b.status === "Activo"
                      ? "rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100"
                  }
                >
                  {b.status}
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
          ))}
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
  value: number;
  label: string;
  tone: "foreground" | "primary";
}) {
  return (
    <div className="rounded-2xl border bg-background p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
      </div>
      <div className={`mt-1 text-3xl font-bold ${tone === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}
