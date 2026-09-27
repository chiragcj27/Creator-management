// Per-sheet knowledge the spreadsheet itself can't tell us: a readable list name, genres or tags
// implied by the sheet, and fixes for sheets whose header row doesn't match the data underneath.
// Sheets not listed here are imported with their sheet name as the list name.
export interface SheetConfig {
  label?: string;
  genres?: string[];
  tags?: string[];
  skip?: boolean;
  /** Replaces the first header row when the sheet's own header is misaligned with its data. */
  headerOverride?: string[];
  /** A title row matching `marker` starts a different list further down the same sheet. */
  sections?: ({ marker: RegExp } & Pick<SheetConfig, "label" | "genres" | "tags">)[];
}

export const SHEET_CONFIG: Record<string, SheetConfig> = {
  sheet1: { label: "Sheet1" },
  roaster: { label: "Roster", tags: ["Roster"] },
  sanfe: { label: "Sanfe" },
  "fitness creators both": { label: "Fitness creators", genres: ["Fitness"] },
  "new profiles": { label: "New profiles" },
  "try moody oocm": { label: "Try Moody (OOCM)" },
  "try moody batch 1": {
    label: "Try Moody batch 1",
    headerOverride: ["Full name", "Followers", "Instagram profile link", "Phone number", "Full Address"],
  },
  "try moody batch 2": { label: "Try Moody batch 2" },
  incroy: { label: "Incroy" },
  "animal, sorry sugar": { label: "Animal × Sorry Sugar" },
  "oocm big sheet": { skip: true }, // only holds a Google Sheets link
  realme: { label: "Realme" },
  "taco bell": { label: "Taco Bell" },
  "jewellery sheet": { label: "Jewellery" },
  ugc: { label: "UGC", tags: ["UGC"] },
  "shabd ugc": { label: "Shabd UGC", tags: ["UGC"] },
  nivea: { label: "Nivea" },
  "bliss snack": { label: "Bliss Snack" },
  "swiggy collab": { label: "Swiggy" },
  sheet18: { label: "Sheet18" },
  "mw closet": { label: "MW Closet" },
  litt: { label: "Litt" },
  "dr sheths": { label: "Dr. Sheth's" },
  comedy: { label: "Comedy creators", genres: ["Comedy"] },
  billu: { label: "Billu" },
  "animal beer tanya": { label: "Animal Beer" },
  "safari collab": { label: "Safari" },
  benettoncollab: { label: "Benetton" },
  "mom creators": { label: "Mom creators", genres: ["Parenting"] },
  "mom daughter creators": {
    label: "Mom & daughter creators",
    genres: ["Parenting"],
    tags: ["Mom & Daughter"],
    sections: [{ marker: /renne girls/i, label: "Renne girls" }],
  },
};

export function sheetConfig(sheetName: string): SheetConfig {
  return SHEET_CONFIG[sheetName.trim().toLowerCase()] ?? {};
}
