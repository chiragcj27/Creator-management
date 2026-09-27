/** Kept dependency-free (no server/crypto imports) so client components can import it directly. */

export const ROLES = ["admin", "restricted"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Full access",
  restricted: "No contact details",
};
