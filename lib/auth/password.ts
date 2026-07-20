/**
 * Password hashing and verification for saved accounts
 * (`docs/05_Account_Creation_and_Temporary_Access.md`, roadmap Phase 7:
 * "Use secure password hashing").
 *
 * Uses Node's built-in scrypt — an OWASP-recommended, memory-hard KDF — so there is no
 * native dependency to compile on Vercel. Every password gets a unique random salt, and
 * the stored value is self-describing: `scrypt$<N>$<saltHex>$<hashHex>`. Embedding the
 * cost parameter lets it be raised later without invalidating existing hashes.
 * Verification is constant-time to resist timing attacks.
 *
 * @module lib/auth/password
 */

import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Promise wrapper around scrypt's options-aware callback overload.
 *
 * `util.promisify()` drops that overload from its type signature, so the callback form
 * is wrapped explicitly to keep `maxmem`/`N` typed.
 *
 * @param password - Plaintext password to derive from.
 * @param salt - Per-password random salt.
 * @param keylen - Desired derived-key length in bytes.
 * @param options - scrypt cost options (`N`, `maxmem`, ...).
 * @returns The derived key buffer.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * scrypt cost parameter (2^15). Stored inside each encoded hash so it can be increased
 * later without breaking verification of previously stored passwords.
 */
const SCRYPT_COST = 1 << 15;
/** Derived-key length in bytes. */
const KEY_LENGTH = 64;
/** Random salt length in bytes. */
const SALT_BYTES = 16;
/**
 * Memory ceiling for scrypt. At N=2^15 (r=8) scrypt needs ~32 MiB, which meets Node's
 * default `maxmem` exactly and errors; this raises the limit with headroom so hashing
 * succeeds.
 */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/**
 * Hashes a plaintext password into a self-describing, storable string.
 *
 * @param password - The plaintext password. Must be non-empty.
 * @returns A `scrypt$<N>$<saltHex>$<hashHex>` string safe to persist in `User.passwordHash`.
 * @throws {Error} When `password` is empty.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Cannot hash an empty password.");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a previously stored hash.
 *
 * Parses the cost and salt out of the stored value and re-derives the key using the
 * *stored* cost (not the current constant), so old hashes keep verifying after the cost
 * is bumped. Any malformed, unrecognized, or absent stored value yields `false` rather
 * than throwing, giving callers uniform "invalid credentials" behavior. The final
 * comparison is constant-time.
 *
 * @param password - The plaintext password to check.
 * @param storedHash - The stored `scrypt$...` value, or `null`/`undefined`.
 * @returns `true` only when the password reproduces the stored hash; otherwise `false`.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!password || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) {
    return false;
  }

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: cost,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
