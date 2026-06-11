import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNull } from "drizzle-orm";
import {
  tenants,
  usagers,
  usagerAddresses,
  etablissements,
} from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

const TENANT_SLUG = "demo";

const NOMS = [
  "Martin", "Bernard", "Dubois", "Robert", "Petit", "Durand", "Leroy",
  "Moreau", "Simon", "Laurent", "Lefebvre", "Garcia", "David", "Bertrand",
  "Roux", "Vincent", "Fournier", "Morel", "Girard", "André",
];
const PRENOMS_PARENTS = [
  "Sophie", "Marie", "Nathalie", "Isabelle", "Julie", "Sandrine", "Caroline",
  "Pierre", "Olivier", "Stéphane", "Christophe", "Frédéric", "Laurent", "David",
];
const RUES = [
  "rue de la République", "avenue Victor Hugo", "rue Jean Jaurès",
  "boulevard Émile Combes", "place de la Mairie", "avenue de la Libération",
  "chemin des Oliviers", "rue Frédéric Mistral", "avenue de Provence",
  "rue du 8 mai 1945", "impasse des Lilas", "route de Marseille",
  "rue Pasteur", "avenue Charles de Gaulle", "rue Gambetta",
  "lotissement Les Cyprès", "chemin du Moulin", "place Saint-Roch",
];

const TRANSPORT_TYPES = [
  "taxi_collectif_individuel",
  "transport_famille",
  "transport_commun",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function maybe(probability: number) {
  return Math.random() < probability;
}

/** Generate a random PEC pattern for a week (lun=1 .. ven=5, optional sam=6) */
function randomDays(): { day: number; parity: "all" | "even" | "odd" }[] {
  const pattern = randInt(1, 5);
  // 1: every weekday, 2: every weekday except wed, 3: mon/tue/thu/fri,
  // 4: split mon-wed-fri (every week) + tue-thu (alternate), 5: random subset
  switch (pattern) {
    case 1:
      return [1, 2, 3, 4, 5].map((d) => ({ day: d, parity: "all" as const }));
    case 2:
      return [1, 2, 4, 5].map((d) => ({ day: d, parity: "all" as const }));
    case 3:
      return [1, 2, 4, 5].map((d) => ({ day: d, parity: "all" as const }));
    case 4:
      return [
        { day: 1, parity: "all" as const },
        { day: 2, parity: maybe(0.5) ? "even" as const : "odd" as const },
        { day: 3, parity: "all" as const },
        { day: 4, parity: maybe(0.5) ? "even" as const : "odd" as const },
        { day: 5, parity: "all" as const },
      ];
    default: {
      const days = [1, 2, 3, 4, 5].filter(() => maybe(0.7));
      if (days.length === 0) days.push(1, 3, 5);
      return days.map((d) => ({ day: d, parity: "all" as const }));
    }
  }
}

async function main() {
  console.log("🏠 Seeding addresses + PEC...");

  const tenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1)
    .then((r) => r[0]);

  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' introuvable`);
  const tenantId = tenant.id;

  // Fetch usagers + their établissement (for the city)
  const usagersList = await db
    .select({
      id: usagers.id,
      lastName: usagers.lastName,
      etablissementCity: etablissements.city,
      etablissementPostalCode: etablissements.postalCode,
      etablissementLat: etablissements.latitude,
      etablissementLng: etablissements.longitude,
    })
    .from(usagers)
    .leftJoin(etablissements, eq(usagers.etablissementId, etablissements.id))
    .where(and(eq(usagers.tenantId, tenantId), isNull(usagers.deletedAt)));

  console.log(`✓ ${usagersList.length} usagers à enrichir`);

  let totalAddresses = 0;
  let usagersWithSplitCustody = 0;

  for (const u of usagersList) {
    // Skip if addresses already exist
    const existing = await db
      .select({ id: usagerAddresses.id })
      .from(usagerAddresses)
      .where(eq(usagerAddresses.usagerId, u.id))
      .limit(1);
    if (existing.length > 0) continue;

    // Base coordinates = établissement (city) with jitter to simulate a neighbourhood
    const baseLat = u.etablissementLat ?? 43.6768;
    const baseLng = u.etablissementLng ?? 4.6308;
    const city = u.etablissementCity ?? "Arles";
    const postalCode = u.etablissementPostalCode ?? "13200";

    const isSplitCustody = maybe(0.18); // 18% of usagers have split custody
    // Transport type is now carried by the usager (no longer by the address).
    const transportType = pick(TRANSPORT_TYPES);
    await db
      .update(usagers)
      .set({ transportType })
      .where(eq(usagers.id, u.id));

    // Address #1 — primary home (parents or mother)
    const lastName1 = u.lastName;
    const responsibleFirst1 = pick(PRENOMS_PARENTS);
    const days1Aller = randomDays();
    const days1Retour = isSplitCustody
      ? days1Aller.filter((d) => maybe(0.7))
      : days1Aller;

    await db.insert(usagerAddresses).values({
      tenantId,
      usagerId: u.id,
      position: 1,
      type: isSplitCustody ? "mere" : "parents",
      civility: isSplitCustody ? "Mme" : "Mme",
      responsibleLastName: lastName1,
      responsibleFirstName: responsibleFirst1,
      address: `${randInt(1, 99)} ${pick(RUES)}`,
      city,
      postalCode,
      latitude: baseLat + (Math.random() - 0.5) * 0.04,
      longitude: baseLng + (Math.random() - 0.5) * 0.04,
      phone: `04${String(randInt(10000000, 99999999))}`,
      mobile: `06${String(randInt(10000000, 99999999))}`,
      daysAller: days1Aller,
      daysRetour: days1Retour,
    });
    totalAddresses++;

    // Address #2 — split custody (separated father) or occasional grandparent
    if (isSplitCustody) {
      usagersWithSplitCustody++;
      const remainingDays = [1, 2, 3, 4, 5].filter(
        (d) => !days1Aller.find((entry) => entry.day === d),
      );
      const days2Aller =
        remainingDays.length > 0
          ? remainingDays.map((d) => ({ day: d, parity: "all" as const }))
          : [
              { day: 1, parity: "even" as const },
              { day: 3, parity: "even" as const },
              { day: 5, parity: "even" as const },
            ];

      await db.insert(usagerAddresses).values({
        tenantId,
        usagerId: u.id,
        position: 2,
        type: "pere",
        civility: "M.",
        responsibleLastName: pick(NOMS).toUpperCase(),
        responsibleFirstName: pick(PRENOMS_PARENTS),
        address: `${randInt(1, 99)} ${pick(RUES)}`,
        city,
        postalCode,
        latitude: baseLat + (Math.random() - 0.5) * 0.06,
        longitude: baseLng + (Math.random() - 0.5) * 0.06,
        phone: `04${String(randInt(10000000, 99999999))}`,
        mobile: `06${String(randInt(10000000, 99999999))}`,
        daysAller: days2Aller,
        daysRetour: days2Aller,
      });
      totalAddresses++;
    } else if (maybe(0.12)) {
      // 12% of the others have a 2nd occasional address (grandparent)
      await db.insert(usagerAddresses).values({
        tenantId,
        usagerId: u.id,
        position: 2,
        type: "grand_parent",
        civility: "Mme",
        responsibleLastName: pick(NOMS).toUpperCase(),
        responsibleFirstName: pick(PRENOMS_PARENTS),
        address: `${randInt(1, 99)} ${pick(RUES)}`,
        city,
        postalCode,
        latitude: baseLat + (Math.random() - 0.5) * 0.08,
        longitude: baseLng + (Math.random() - 0.5) * 0.08,
        phone: `04${String(randInt(10000000, 99999999))}`,
        daysAller: [
          { day: 3, parity: "all" as const },
          { day: 5, parity: "even" as const },
        ],
        daysRetour: [
          { day: 3, parity: "all" as const },
          { day: 5, parity: "even" as const },
        ],
      });
      totalAddresses++;
    }
  }

  console.log(`✓ ${totalAddresses} adresses créées`);
  console.log(`  dont ${usagersWithSplitCustody} usagers en garde alternée`);
  console.log("✅ Seed adresses terminé.");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed error:", err);
  client.end();
  process.exit(1);
});
