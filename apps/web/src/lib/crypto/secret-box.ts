/**
 * Chiffrement symétrique des secrets par tenant (clés d'API providers).
 *
 * AES-256-GCM. La clé maître est dérivée d'`AUTH_SECRET` via HKDF-SHA256
 * (aucune nouvelle variable d'environnement à gérer). Le `salt`/`info` de
 * domaine isolent cet usage des autres dérivations éventuelles.
 *
 * ⚠️ Server-only : importe `node:crypto` + `AUTH_SECRET`. Ne jamais importer
 * ce module côté client (le bundle casserait de toute façon sur `node:crypto`).
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
} from "node:crypto";

const ALG = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits (recommandé pour GCM)
const VERSION = "v1";

/** Clé maître dérivée d'AUTH_SECRET via HKDF-SHA256 (info de domaine). */
function masterKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET manquant (racine de chiffrement des clés provider).",
    );
  }
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      "scomap-provider-keys-salt-v1",
      "tenant-api-key",
      KEY_LEN,
    ),
  );
}

/** Chiffre un secret -> "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>". */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, masterKey(), iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/** Déchiffre un secret. Throw si format/tag invalide (ex. rotation d'AUTH_SECRET). */
export function decryptSecret(stored: string): string {
  const [v, ivB64, tagB64, dataB64] = stored.split(":");
  if (v !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Format de ciphertext invalide.");
  }
  const decipher = createDecipheriv(
    ALG,
    masterKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(), // throw si le tag d'authentification est invalide
  ]).toString("utf8");
}
