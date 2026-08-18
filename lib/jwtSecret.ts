/**
 * Single source of truth for the JWT signing secret.
 *
 * Previously every file had its own fallback ("changeme", "devilboy...",
 * process.env.JWT_SECRET!) which meant a token signed in one place could not be
 * verified in another when JWT_SECRET was not set — admin login "succeeded" but
 * the middleware immediately bounced the user back to /admin/login.
 */
export const JWT_SECRET =
  process.env.JWT_SECRET || "pw-marco-fallback-secret-change-me-in-env";

/** Web-crypto (jose) friendly version of the same secret. */
export const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET);
