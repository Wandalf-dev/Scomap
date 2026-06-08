import type { Metadata } from "next";
import Link from "next/link";
import { caller } from "@/lib/trpc/server";
import { BuildingOffice2Icon } from "@/components/ui/building-office2-icon";
import { UsersIcon } from "@/components/ui/users-icon";
import { ShareIcon } from "@/components/ui/share-icon";
import { ArrowPathRoundedSquareIcon } from "@/components/ui/arrow-path-rounded-square-icon";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const [etablissements, usagers, circuits, trajetsAujourdhui] =
    await Promise.all([
      caller.etablissements.list(),
      caller.usagers.list(),
      caller.circuits.list(),
      caller.trajets.listOccurrences({ fromDate: today, toDate: today }),
    ]);

  const circuitsActifs = circuits.filter((c) => !c.archivedAt).length;

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
            icon={BuildingOffice2Icon}
            href="/etablissements"
          />
          <StatCard
            title="Usagers"
            value={String(usagers.length)}
            icon={UsersIcon}
            href="/usagers"
          />
          <StatCard
            title="Circuits actifs"
            value={String(circuitsActifs)}
            icon={ShareIcon}
            href="/circuits"
          />
          <StatCard
            title="Trajets aujourd'hui"
            value={String(trajetsAujourdhui.length)}
            icon={ArrowPathRoundedSquareIcon}
            href="/trajets"
          />
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
  href,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[0.3rem] border border-border bg-card p-6 transition-colors hover:bg-card/80 hover:border-primary/40 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </Link>
  );
}
