import { School, Users, Route, Map } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { caller } from "@/lib/trpc/server";

export default async function DashboardPage() {
  const etablissements = await caller.etablissements.list();

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble de votre activité
          </p>
        </div>
      </div>

      <div className="px-4 lg:px-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Établissements"
            value={String(etablissements.length)}
            icon={School}
          />
          <StatCard title="Usagers" value="0" icon={Users} />
          <StatCard title="Circuits actifs" value="0" icon={Route} />
          <StatCard title="Trajets aujourd'hui" value="0" icon={Map} />
        </div>

        {/* Welcome card */}
        <div className="rounded-[0.3rem] border border-border bg-card p-6 transition-colors hover:bg-card/80">
          <p className="text-muted-foreground">
            Bienvenue sur Scomap. Commencez par ajouter vos établissements et
            usagers.
          </p>
        </div>
      </div>
    </>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[0.3rem] border border-border bg-card p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
