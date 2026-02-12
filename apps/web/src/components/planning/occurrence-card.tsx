"use client";

const STATUS_DOTS: Record<string, string> = {
  planifie: "bg-muted-foreground",
  en_cours: "bg-blue-500",
  termine: "bg-green-500",
  annule: "bg-red-500",
};

interface OccurrenceCardProps {
  trajetName: string;
  direction: string;
  departureTime: string | null;
  status: string;
  chauffeurName: string | null;
  onClick: () => void;
}

export function OccurrenceCard({
  trajetName,
  direction,
  departureTime,
  status,
  chauffeurName,
  onClick,
}: OccurrenceCardProps) {
  const isAller = direction === "aller";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[0.3rem] border px-2 py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-accent/50 ${
        isAller
          ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"
          : "border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            STATUS_DOTS[status] ?? STATUS_DOTS.planifie
          }`}
        />
        {departureTime && (
          <span className="font-mono font-medium shrink-0">
            {departureTime}
          </span>
        )}
        <span className="truncate font-medium">{trajetName}</span>
      </div>
      {chauffeurName && (
        <div className="mt-0.5 truncate text-muted-foreground pl-3">
          {chauffeurName}
        </div>
      )}
    </button>
  );
}
