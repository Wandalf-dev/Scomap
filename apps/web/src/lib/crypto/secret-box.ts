/**
 * Symmetric encryption of per-tenant secrets (provider API keys).
 *
 * AES-256-GCM. The master key is derived from `PROVIDER_KEYS_SECRET` (or
 * `AUTH_SECRET` as fallback) via HKDF-SHA256. The domain `salt`/`info`
 * isolates this usage from any other derivations.
 *
 * In production, set `PROVIDER_KEYS_SECRET` distinct from `AUTH_SECRET`:
 * otherwise a single secret protects both sessions AND key encryption,
 * and rotating one invalidates the other. ⚠️ Rotating this secret makes
 * already-encrypted keys unreadable (they must be re-entered).
 *
 * ⚠️ Server-only: imports `node:crypto` + env secrets. Never import this
 * module on the client side (the bundle would break on `node:crypto` anyway).
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
} from "node:crypto";

const ALG = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits (recommended for GCM)
const VERSION = "v1";

/** Master key derived via HKDF-SHA256 (domain info). */
function masterKey(): Buffer {
  const secret =
    process.env.PROVIDER_KEYS_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "PROVIDER_KEYS_SECRET ou AUTH_SECRET manquant (racine de chiffrement des clés provider).",
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

/** Encrypts a secret -> "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>". */
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

/** Decrypts a secret. Throws if format/tag is invalid (e.g. AUTH_SECRET rotation). */
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
    decipher.final(), // throws if the authentication tag is invalid
  ]).toString("utf8");
}
