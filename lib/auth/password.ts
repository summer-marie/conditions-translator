// Password hashing for saved accounts (docs/05_Account_Creation_and_Temporary_Access.md,
// docs/08 roadmap Phase 7: "Use secure password hashing").
//
// Uses Node's built-in scrypt (an OWASP-recommended, memory-hard KDF) so there is no native
// dependency to build on Vercel. Each password gets a unique random salt; the stored value is
// self-describing: `scrypt$<N>$<saltHex>$<hashHex>`. Verification is constant-time.

import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// Promise wrapper around scrypt's options-aware callback overload (promisify() drops that overload
// from its type signature, so we wrap it explicitly).
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

// scrypt cost parameter (2^15). Kept in the encoded hash so it can be raised later without
// invalidating existing hashes.
const SCRYPT_COST = 1 << 15;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// At N=2^15 (r=8) scrypt needs ~32 MiB, which meets Node's default maxmem ceiling exactly and
// errors; raise the limit with headroom so hashing succeeds.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/** Hashes a plaintext password into a self-describing, storable string. */
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
 * Verifies a plaintext password against a stored hash. Returns false (never throws) for a
 * malformed or unrecognized stored value so callers get uniform "invalid credentials" behavior.
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
