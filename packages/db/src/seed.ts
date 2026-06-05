import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import {
  tenants,
  etablissements,
  usagers,
  circuits,
  tenantCounters,
} from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

const TENANT_SLUG = "demo";
const TRANSPORT_START = "2025-09-01";
const TRANSPORT_END = "2026-07-04";

// Données de référence
const VILLES_PACA = [
  { city: "Arles", postalCode: "13200", lat: 43.6768, lng: 4.6308 },
  { city: "Tarascon", postalCode: "13150", lat: 43.806, lng: 4.6614 },
  { city: "Saint-Rémy-de-Provence", postalCode: "13210", lat: 43.7889, lng: 4.831 },
  { city: "Salon-de-Provence", postalCode: "13300", lat: 43.6404, lng: 5.0975 },
  { city: "Aix-en-Provence", postalCode: "13100", lat: 43.5297, lng: 5.4474 },
  { city: "Marseille", postalCode: "13001", lat: 43.2965, lng: 5.3698 },
  { city: "Avignon", postalCode: "84000", lat: 43.9493, lng: 4.8055 },
  { city: "Nîmes", postalCode: "30000", lat: 43.8367, lng: 4.3601 },
  { city: "Cavaillon", postalCode: "84300", lat: 43.8364, lng: 5.0386 },
  { city: "Carpentras", postalCode: "84200", lat: 44.0556, lng: 5.0479 },
  { city: "Orange", postalCode: "84100", lat: 44.1372, lng: 4.8082 },
  { city: "Apt", postalCode: "84400", lat: 43.876, lng: 5.397 },
  { city: "Manosque", postalCode: "04100", lat: 43.8285, lng: 5.7855 },
  { city: "Digne-les-Bains", postalCode: "04000", lat: 44.0922, lng: 6.2356 },
  { city: "Sisteron", postalCode: "04200", lat: 44.1955, lng: 5.943 },
  { city: "Briançon", postalCode: "05100", lat: 44.8973, lng: 6.6336 },
  { city: "Gap", postalCode: "05000", lat: 44.5594, lng: 6.0807 },
  { city: "Embrun", postalCode: "05200", lat: 44.5642, lng: 6.4953 },
  { city: "Forcalquier", postalCode: "04300", lat: 43.9586, lng: 5.7813 },
  { city: "Châteaurenard", postalCode: "13160", lat: 43.8842, lng: 4.857 },
];

const ECOLES_NOMS = [
  "École Jean Moulin", "École Victor Hugo", "École Frédéric Mistral",
  "École Jules Ferry", "École Marie Curie", "École Antoine de Saint-Exupéry",
  "École Pasteur", "École La Fontaine", "École Jean Jaurès",
  "École Anatole France", "École Pablo Picasso",
];

const COLLEGES_NOMS = [
  "Collège Frédéric Mistral", "Collège Jean Moulin", "Collège Mont-Ventoux",
  "Collège Roumanille", "Collège Vincent van Gogh", "Collège Lou Calen",
  "Collège Marcel Pagnol", "Collège René Char", "Collège Daudet",
];

const PRENOMS_M = [
  "Lucas", "Léo", "Hugo", "Gabriel", "Louis", "Arthur", "Jules", "Adam",
  "Noah", "Raphaël", "Liam", "Mohamed", "Sacha", "Eden", "Aaron",
  "Maël", "Tom", "Théo", "Nathan", "Ethan", "Marius", "Léon", "Paul",
  "Antoine", "Baptiste", "Maxime", "Romain", "Mattéo", "Naël",
];

const PRENOMS_F = [
  "Jade", "Louise", "Emma", "Alice", "Ambre", "Léa", "Chloé", "Lina",
  "Mia", "Rose", "Anna", "Inès", "Iris", "Lou", "Manon", "Camille",
  "Sarah", "Eva", "Zoé", "Capucine", "Margaux", "Juliette", "Nina",
  "Romane", "Charlotte", "Julia", "Agathe", "Maëlys", "Clara",
];

const NOMS = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit",
  "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel",
  "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
  "Morel", "Girard", "André", "Lefèvre", "Mercier", "Dupont", "Lambert",
  "Bonnet", "François", "Martinez", "Legrand", "Garnier", "Faure",
  "Rousseau", "Blanc", "Guérin", "Muller", "Henry", "Roussel", "Nicolas",
  "Perrin", "Morin", "Mathieu", "Clément", "Gauthier", "Dumont", "Lopez",
];

const RUES = [
  "rue de la République", "avenue Victor Hugo", "rue Jean Jaurès",
  "boulevard Émile Combes", "place de la Mairie", "avenue de la Libération",
  "chemin des Oliviers", "rue Frédéric Mistral", "avenue de Provence",
  "rue du 8 mai 1945", "impasse des Lilas", "route de Marseille",
  "rue Pasteur", "avenue Charles de Gaulle", "rue Gambetta",
];

const CLASSES_ECOLE = ["ps", "ms", "gs", "cp", "ce1", "ce2", "cm1", "cm2"];
const CLASSES_COLLEGE = ["6eme", "5eme", "4eme", "3eme"];
const TRANSPORT_TYPES = ["taxi_collectif_individuel", "transport_famille", "transport_commun"];
const REGIMES = ["demi_pensionnaire", "interne", "externe"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBirthDate(minAge: number, maxAge: number): string {
  const today = new Date();
  const year = today.getFullYear() - randInt(minAge, maxAge);
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Récupérer le tenant demo
  const tenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1)
    .then((r) => r[0]);

  if (!tenant) {
    throw new Error(`Tenant '${TENANT_SLUG}' introuvable. Crée-le d'abord.`);
  }
  const tenantId = tenant.id;
  console.log(`✓ Tenant: ${TENANT_SLUG} (${tenantId})`);

  // 2. Créer 20 établissements
  const etabRows: { id: string; type: string }[] = [];
  const ecolesCount = 12;
  const collegesCount = 8;

  for (let i = 0; i < ecolesCount; i++) {
    const ville = pick(VILLES_PACA);
    const nom = ECOLES_NOMS[i] ?? `École N°${i + 1}`;
    const inserted = await db
      .insert(etablissements)
      .values({
        tenantId,
        name: `${nom} - ${ville.city}`,
        type: "ecole",
        address: `${randInt(1, 99)} ${pick(RUES)}`,
        city: ville.city,
        postalCode: ville.postalCode,
        latitude: ville.lat + (Math.random() - 0.5) * 0.02,
        longitude: ville.lng + (Math.random() - 0.5) * 0.02,
        phone: `04${String(randInt(10000000, 99999999))}`,
        regime: Math.random() > 0.3 ? "public" : "prive",
      })
      .returning({ id: etablissements.id });
    etabRows.push({ id: inserted[0]!.id, type: "ecole" });
  }

  for (let i = 0; i < collegesCount; i++) {
    const ville = pick(VILLES_PACA);
    const nom = COLLEGES_NOMS[i] ?? `Collège N°${i + 1}`;
    const inserted = await db
      .insert(etablissements)
      .values({
        tenantId,
        name: `${nom} - ${ville.city}`,
        type: "college",
        address: `${randInt(1, 99)} ${pick(RUES)}`,
        city: ville.city,
        postalCode: ville.postalCode,
        latitude: ville.lat + (Math.random() - 0.5) * 0.02,
        longitude: ville.lng + (Math.random() - 0.5) * 0.02,
        phone: `04${String(randInt(10000000, 99999999))}`,
        regime: Math.random() > 0.3 ? "public" : "prive",
      })
      .returning({ id: etablissements.id });
    etabRows.push({ id: inserted[0]!.id, type: "college" });
  }

  console.log(`✓ ${etabRows.length} établissements créés`);

  // 3. Créer 100 usagers
  // Récupérer le compteur actuel d'usagers pour ce tenant
  const counterRow = await db
    .select({ lastValue: tenantCounters.lastValue })
    .from(tenantCounters)
    .where(
      sql`${tenantCounters.tenantId} = ${tenantId} AND ${tenantCounters.entity} = 'usagers'`,
    )
    .limit(1)
    .then((r) => r[0]);

  let nextDisplayId = (counterRow?.lastValue ?? 0) + 1;
  const usagersToCreate = 100;
  const startDisplayId = nextDisplayId;

  for (let i = 0; i < usagersToCreate; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = isMale ? pick(PRENOMS_M) : pick(PRENOMS_F);
    const lastName = pick(NOMS).toUpperCase();
    const etab = pick(etabRows);
    const classes = etab.type === "ecole" ? CLASSES_ECOLE : CLASSES_COLLEGE;
    const minAge = etab.type === "ecole" ? 3 : 11;
    const maxAge = etab.type === "ecole" ? 11 : 15;

    await db.insert(usagers).values({
      tenantId,
      displayId: nextDisplayId++,
      firstName,
      lastName,
      birthDate: randomBirthDate(minAge, maxAge),
      gender: isMale ? "M" : "F",
      status: pick(["controle", "controle", "non_controle", "en_attente", "modifie", "a_reconduire", "refuse_annule"]),
      regime: pick(REGIMES),
      etablissementId: etab.id,
      classe: pick(classes),
      transportStartDate: TRANSPORT_START,
      transportEndDate: TRANSPORT_END,
    });
  }

  // Mettre à jour le compteur
  await db
    .insert(tenantCounters)
    .values({
      tenantId,
      entity: "usagers",
      lastValue: nextDisplayId - 1,
    })
    .onConflictDoUpdate({
      target: [tenantCounters.tenantId, tenantCounters.entity],
      set: { lastValue: nextDisplayId - 1 },
    });

  console.log(`✓ ${usagersToCreate} usagers créés (#${startDisplayId} → #${nextDisplayId - 1})`);

  // 4. Créer 10 circuits
  const circuitNames = [
    "Circuit Matin Centre", "Circuit Matin Nord", "Circuit Matin Sud",
    "Circuit Midi Retour", "Circuit Soir Centre", "Circuit Soir Nord",
    "Circuit Soir Sud", "Circuit Mercredi", "Circuit Périscolaire",
    "Circuit Cantine",
  ];

  for (let i = 0; i < circuitNames.length; i++) {
    const etab = pick(etabRows);
    await db.insert(circuits).values({
      tenantId,
      etablissementId: etab.id,
      name: circuitNames[i]!,
      isActive: true,
      operatingDays: [1, 2, 3, 4, 5],
      startDate: TRANSPORT_START,
      endDate: TRANSPORT_END,
    });
  }

  console.log(`✓ ${circuitNames.length} circuits créés`);

  console.log("✅ Seed terminé.");
  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed error:", err);
  client.end();
  process.exit(1);
});
