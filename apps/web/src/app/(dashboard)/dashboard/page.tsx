import { caller } from "@/lib/trpc/server";

export default async function DashboardPage() {
  const etablissements = await caller.etablissements.list();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Établissements" value={String(etablissements.length)} />
        <StatCard title="Usagers" value="0" />
        <StatCard title="Circuits actifs" value="0" />
        <StatCard title="Trajets aujourd'hui" value="0" />
      </div>

      {/* Placeholder for more content */}
      <div className="rounded-[0.3rem] border border-border bg-card p-6">
        <p className="text-muted-foreground">
          Bienvenue sur Scomap. Commencez par ajouter vos établissements et
          usagers.
        </p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[0.3rem] border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
