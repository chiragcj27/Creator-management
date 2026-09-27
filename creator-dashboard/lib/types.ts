export const STATUSES = ["New", "Contacted", "In talks", "Onboarded", "Do not contact"] as const;
export type Status = (typeof STATUSES)[number];

export const GENRE_STATUSES = ["untagged", "auto", "needs-review", "verified"] as const;
export type GenreStatus = (typeof GENRE_STATUSES)[number];

/** Where the genre came from: a genre-named sheet, the creator's own form answer, a profile check in the browser, or a manual edit. */
export type GenreSource = "sheet" | "self-reported" | "browser" | "manual";

export type Gender = "Male" | "Female";

/** Any extra column from a source sheet (commercials, payout, story status, remarks...), kept so nothing is lost. */
export interface Detail {
  list: string;
  field: string;
  value: string;
}

export interface SourceRef {
  file: string;
  sheet: string;
  row: number; // 1-based, as Excel shows it
}

export interface Creator {
  handle: string; // lowercase Instagram username, unique key
  name: string | null;
  instagramUrl: string;
  followers: number | null;
  gender: Gender | null;
  phones: string[];
  emails: string[];
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  genres: string[];
  genreStatus: GenreStatus;
  genreSource: GenreSource | null;
  nicheRaw: string[]; // what the creator wrote about their niche
  bio?: string | null; // Instagram bio, saved when the profile is checked in the browser
  tags: string[];
  lists: string[]; // campaigns / lists this creator appeared in
  manager: string | null; // agency point of contact
  avgViews: number | null;
  status: Status;
  notes: string;
  details: Detail[];
  sources: SourceRef[];
  firstSeenAt: Date | null; // earliest form timestamp, if any
  createdAt: Date;
  updatedAt: Date;
}

export type CreatorDTO = Omit<Creator, "firstSeenAt" | "createdAt" | "updatedAt"> & {
  _id: string;
  firstSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface ImportSummary {
  file: string;
  sheetsRead: string[];
  sheetsSkipped: string[];
  rowsWithCreator: number;
  uniqueInFile: number;
  inserted: number;
  updated: number;
  skippedRows: number;
  skippedExamples: { sheet: string; row: number; name: string; value: string }[];
}
