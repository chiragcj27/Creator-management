import type { NextRequest } from "next/server";
import { ROLES, type Role } from "./role";

export const SESSION_COOKIE = "cd_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set. Add it to .env.local (see README).");
  return new TextEncoder().encode(secret);
}

// Uses only Web Crypto + btoa/atob (no Buffer) so this also works in the Edge middleware runtime.
function toBase64Url(buf: ArrayBuffer): string {
  let str = "";
  for (const b of new Uint8Array(buf)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", getSecret() as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data) as BufferSource);
  return toBase64Url(sig);
}

/** Signs a role + expiry into an opaque cookie value. Whoever holds AUTH_SECRET can forge one, so keep it private. */
export async function signSession(role: Role): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${role}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(value: string | undefined | null): Promise<Role | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [role, expiresStr, sig] = parts;
  if (!(ROLES as readonly string[]).includes(role)) return null;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  if ((await hmac(`${role}.${expiresStr}`)) !== sig) return null;
  return role as Role;
}

/** API routes / middleware: read the role straight off the request's cookies. */
export async function getRoleFromRequest(req: NextRequest): Promise<Role | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Server components: read the role via next/headers (not usable in middleware). */
export async function getServerRole(): Promise<Role | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export function checkPassword(password: string): Role | null {
  if (!password) return null;
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return "admin";
  if (process.env.RESTRICTED_PASSWORD && password === process.env.RESTRICTED_PASSWORD) return "restricted";
  return null;
}

/** Blanks phone/email fields for the restricted role; full access passes through unchanged. */
export function redactContacts<T extends { phones: string[]; emails: string[] }>(doc: T, role: Role | null): T {
  if (role === "admin") return doc;
  return { ...doc, phones: [], emails: [] };
}

/** Same, but for a campaign DTO's embedded creator rows. */
export function redactCampaignCreators<T extends { creators: { phones: string[]; emails: string[] }[] }>(
  dto: T,
  role: Role | null,
): T {
  if (role === "admin") return dto;
  return { ...dto, creators: dto.creators.map((c) => redactContacts(c, role)) };
}

/** Drops contact-detail keys from an incoming write body when the role isn't allowed to set them. */
export function stripContactInput<T extends Record<string, unknown>>(body: T, role: Role | null): T {
  if (role === "admin") return body;
  const clone: Record<string, unknown> = { ...body };
  delete clone.phones;
  delete clone.emails;
  delete clone.phone;
  delete clone.email;
  return clone as T;
}

export type { Role };
