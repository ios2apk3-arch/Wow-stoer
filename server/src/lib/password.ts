import argon2 from "argon2";

/**
 * Argon2id at OWASP's recommended settings. Deliberately slow: the cost is
 * paid once per login and makes an offline crack of a leaked hash expensive.
 */
const options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, options);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed hash must read as "wrong password", never as a crash.
    return false;
  }
}
