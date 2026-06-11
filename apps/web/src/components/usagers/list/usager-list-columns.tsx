import { UsagerStatusBadge } from "@/components/usagers/usager-status-badge";
import {
  USAGER_STATUS_LABELS,
  USAGER_REGIME_LABELS,
  USAGER_TRANSPORT_TYPE_LABELS,
} from "@/lib/validators/usager";
import { CLASSE_LABEL_MAP, formatDate } from "./usager-list-model";
import type { ColumnConfig } from "@/components/shared/data-list";
import type { UsagerRow } from "./usager-list-model";

export const USAGER_LIST_COLUMNS: ColumnConfig<UsagerRow>[] = [
  {
    key: "displayId",
    header: "ID",
    sortable: true,
    className: "w-16",
    render: (row) => (
      <span className="text-muted-foreground tabular-nums">#{row.displayId}</span>
    ),
  },
  {
    key: "code",
    header: "Code",
    sortable: true,
    render: (row) =>
      row.code ? (
        <span className="text-muted-foreground tabular-nums">{row.code}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "lastName",
    header: "Nom",
    sortable: true,
    render: (row) => (
      <span className="font-medium text-foreground">{row.lastName}</span>
    ),
  },
  {
    key: "firstName",
    header: "Prénom",
    sortable: true,
    render: (row) => (
      <span className="text-foreground">{row.firstName}</span>
    ),
  },
  {
    key: "birthDate",
    header: "Date de naissance",
    sortable: true,
    exportValue: (row) => formatDate(row.birthDate),
    render: (row) =>
      formatDate(row.birthDate) ? (
        <span className="text-muted-foreground">{formatDate(row.birthDate)}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "gender",
    header: "Genre",
    sortable: true,
    render: (row) =>
      row.gender ? (
        <span className="text-muted-foreground">{row.gender === "M" ? "M" : "F"}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "status",
    header: "Statut",
    sortable: true,
    exportValue: (row) =>
      USAGER_STATUS_LABELS[row.status as keyof typeof USAGER_STATUS_LABELS] ?? row.status,
    render: (row) => <UsagerStatusBadge status={row.status} />,
  },
  {
    key: "regime",
    header: "Régime",
    sortable: true,
    exportValue: (row) =>
      row.regime
        ? USAGER_REGIME_LABELS[row.regime as keyof typeof USAGER_REGIME_LABELS] ?? row.regime
        : null,
    render: (row) =>
      row.regime ? (
        <span className="text-muted-foreground">
          {USAGER_REGIME_LABELS[row.regime as keyof typeof USAGER_REGIME_LABELS] ?? row.regime}
        </span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "classe",
    header: "Classe",
    sortable: true,
    exportValue: (row) =>
      row.classe ? CLASSE_LABEL_MAP[row.classe] ?? row.classe : null,
    render: (row) =>
      row.classe ? (
        <span className="text-muted-foreground">
          {CLASSE_LABEL_MAP[row.classe] ?? row.classe}
        </span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "transportType",
    header: "Type de transport",
    sortable: true,
    exportValue: (row) =>
      row.transportType
        ? USAGER_TRANSPORT_TYPE_LABELS[
            row.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS
          ] ?? row.transportType
        : null,
    render: (row) =>
      row.transportType ? (
        <span className="text-muted-foreground">
          {USAGER_TRANSPORT_TYPE_LABELS[row.transportType as keyof typeof USAGER_TRANSPORT_TYPE_LABELS] ?? row.transportType}
        </span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "etablissementName",
    header: "Établissement",
    sortable: true,
    render: (row) =>
      row.etablissementName ? (
        <span className="text-muted-foreground">{row.etablissementName}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "etablissementCity",
    header: "Ville",
    sortable: true,
    render: (row) =>
      row.etablissementCity ? (
        <span className="text-muted-foreground">{row.etablissementCity}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "secondaryEtablissementName",
    header: "Établissement secondaire",
    sortable: true,
    render: (row) =>
      row.secondaryEtablissementName ? (
        <span className="text-muted-foreground">{row.secondaryEtablissementName}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "transportStartDate",
    header: "Début transport",
    sortable: true,
    exportValue: (row) => formatDate(row.transportStartDate),
    render: (row) =>
      formatDate(row.transportStartDate) ? (
        <span className="text-muted-foreground">{formatDate(row.transportStartDate)}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "transportEndDate",
    header: "Fin transport",
    sortable: true,
    exportValue: (row) => formatDate(row.transportEndDate),
    render: (row) =>
      formatDate(row.transportEndDate) ? (
        <span className="text-muted-foreground">{formatDate(row.transportEndDate)}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "transportParticularity",
    header: "Particularité transport",
    render: (row) =>
      row.transportParticularity ? (
        <span className="text-muted-foreground">{row.transportParticularity}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "specificity",
    header: "Spécificité",
    render: (row) =>
      row.specificity ? (
        <span className="text-muted-foreground">{row.specificity}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
  {
    key: "notes",
    header: "Notes",
    render: (row) =>
      row.notes ? (
        <span className="text-muted-foreground">{row.notes}</span>
      ) : (
        <span className="text-muted-foreground/60">&mdash;</span>
      ),
  },
];
