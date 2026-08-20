import bcrypt from "bcryptjs";

// No `server-only` guard here: prisma/seed.ts (a plain tsx script, not a
// Next.js server bundle) needs to hash passwords too.
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
