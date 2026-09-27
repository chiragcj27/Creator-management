// Cell-level parsers for messy spreadsheet values.

const NON_PROFILE_PATHS = new Set(["reel", "reels", "p", "stories", "tv", "explore", "accounts", "share", "s", "direct"]);
const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

function cleanHandle(h: string): string | null {
  const handle = h.toLowerCase().replace(/\.+$/, "");
  if (!HANDLE_RE.test(handle) || NON_PROFILE_PATHS.has(handle) || !/[a-z]/.test(handle)) return null;
  return handle;
}

/** Instagram handle from a profile URL, an ig.me link or "Name (@handle) • Instagram" text. */
export function handleFromUrl(value: unknown): string | null {
  const s = String(value ?? "");
  const m =
    s.match(/in[a-z]{0,3}gram\.com\/(?:#!\/)?@?([A-Za-z0-9._]+)/i) ?? // also catches typos like "inatagram.com"
    s.match(/instagr\.am\/([A-Za-z0-9._]+)/i) ??
    s.match(/ig\.me\/(?:u\/)?([A-Za-z0-9._]+)/i) ??
    s.match(/\(@([A-Za-z0-9._]+)\)/);
  return m ? cleanHandle(m[1]) : null;
}

/** A bare "@handle" or "handle" typed into an Instagram column. */
export function handleFromText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s || /[\s/:]/.test(s) || s.includes("@", 1)) return null;
  if (/^\d+$/.test(s)) return null;
  return cleanHandle(s.replace(/^@/, ""));
}

/** "128K", "72.1K", "1M", "1.3 lakhs", "1'280", "7000+", 1993 -> number */
export function parseFollowers(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (looksLikePhoneCell(value)) return null; // a phone number typed into the followers column
  const n = parseCount(value);
  return n !== null && n <= 20_000_000 ? n : null; // anything larger in these sheets is a typo
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!isFinite(value) || value <= 0) return null;
    // "10.6" in a followers column almost always means 10.6k
    return value < 1000 && !Number.isInteger(value) ? Math.round(value * 1000) : Math.round(value);
  }
  const s = String(value).toLowerCase().replace(/[,'’\s+()]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|mn|million|l|lakh|lakhs|lac|lacs)?$/);
  if (!m) return null;
  const mult: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, million: 1e6, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5 };
  const n = parseFloat(m[1]) * (m[2] ? mult[m[2]] : 1);
  return n > 0 && n < 1e9 ? Math.round(n) : null;
}

/** Indian mobile numbers in a cell (handles "+91 98332 12748", "08882366980", "a/b" lists). */
export function parsePhones(value: unknown): string[] {
  const s = String(value ?? "").replace(/[‪-‮]/g, "");
  const out: string[] = [];
  for (const part of s.split(/[\/,;|]|\bor\b/)) {
    let d = part.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    if (/^[6-9]\d{9}$/.test(d)) out.push(d);
  }
  return out;
}

/** True for cells that hold only a phone number, used when scanning a row for an unlabelled phone column. */
export function looksLikePhoneCell(value: unknown): boolean {
  if (typeof value === "number") return parsePhones(value).length > 0;
  const s = String(value ?? "").replace(/[‪-‮]/g, "").trim();
  return /^[+\d\s()\-\/]{10,20}$/.test(s) && parsePhones(s).length > 0;
}

export function parseEmails(value: unknown): string[] {
  const m = String(value ?? "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
  return m ? m.map((e) => e.toLowerCase()) : [];
}

export function cleanText(value: unknown): string | null {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  // "Option 3" is an unfilled Google Forms dropdown, not data
  return s && s !== "-" && !/^(nil|option \d+)$/i.test(s) ? s : null;
}

/** Title-case names typed in ALL CAPS or all lowercase; leave mixed case alone. */
export function cleanName(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    return s.toLowerCase().replace(/(^|[\s(.-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  }
  return s;
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  banglore: "Bengaluru",
  banaglore: "Bengaluru",
  bengaluru: "Bengaluru",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
  "new delhi": "Delhi",
  "west delhi": "Delhi",
  "nort delhi": "Delhi",
  "north delhi": "Delhi",
  "south delhi": "Delhi",
  "east delhi": "Delhi",
  delhi: "Delhi",
  bombay: "Mumbai",
  mumbai: "Mumbai",
  hydrabad: "Hyderabad",
  ahemdabad: "Ahmedabad",
  calcutta: "Kolkata",
};

export function cleanPlace(value: unknown): string | null {
  const s = cleanText(value)?.replace(/[.,]+$/, "");
  if (!s) return null;
  return CITY_ALIASES[s.toLowerCase()] ?? cleanName(s.toLowerCase());
}

export function cleanPincode(value: unknown): string | null {
  const d = String(value ?? "").replace(/\D/g, "");
  return /^[1-9]\d{5}$/.test(d) ? d : null;
}

/** Excel serial date (e.g. 46165.57) -> Date */
export function excelDate(value: unknown): Date | null {
  if (typeof value !== "number" || value < 30000 || value > 80000) return null;
  return new Date(Math.round((value - 25569) * 86400000));
}

export function parseGender(value: unknown): "Male" | "Female" | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (/^(f|female|females|female creators|girl|girls)$/.test(s) || /\bfemale\b/.test(s)) return "Female";
  if (/^(m|male|males|male creators|boy|boys)$/.test(s) || /\bmale\b/.test(s)) return "Male";
  return null;
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}
