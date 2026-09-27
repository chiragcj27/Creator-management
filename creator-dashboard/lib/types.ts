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

export const CAMPAIGN_STATUSES = ["Planning", "Outreach", "Active", "Completed", "Cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Where a creator stands in a campaign, roughly in order. */
export const PIPELINE_STATUSES = [
  "Shortlisted",
  "Invited",
  "Negotiating",
  "Confirmed",
  "Content in progress",
  "Submitted",
  "Live",
  "Paid",
  "Dropped",
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const DELIVERABLE_TYPES = ["Reel", "Story", "Post", "Carousel", "Video", "Other"] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const DELIVERABLE_STATUSES = ["Pending", "Submitted", "Approved", "Live"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

/** One piece of content a creator owes for a campaign. */
export interface Deliverable {
  id: string;
  type: DeliverableType;
  dueDate: Date | null;
  status: DeliverableStatus;
  link: string | null;
  notes: string;
}

/** A creator's row within a campaign: where they stand, what they're owed, what they owe. */
export interface CampaignCreator {
  handle: string;
  status: PipelineStatus;
  rate: number | null; // agreed payment for this campaign
  paid: boolean;
  deliverables: Deliverable[];
  notes: string;
  addedAt: Date;
}

export interface Campaign {
  name: string;
  brand: string | null;
  description: string;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
  budget: number | null; // total budget for the campaign
  platforms: string[];
  targetGenres: string[];
  creators: CampaignCreator[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DeliverableDTO = Omit<Deliverable, "dueDate"> & { dueDate: string | null };

/** A campaign creator row, enriched with a snapshot of their roster profile (name, followers…) when still on file. */
export type CampaignCreatorDTO = Omit<CampaignCreator, "deliverables" | "addedAt"> & {
  deliverables: DeliverableDTO[];
  addedAt: string;
  name: string | null;
  instagramUrl: string;
  followers: number | null;
  genres: string[];
  city: string | null;
  phones: string[];
  emails: string[];
  missing: boolean; // no longer found in the creators roster
};

export type CampaignDTO = Omit<Campaign, "startDate" | "endDate" | "creators" | "createdAt" | "updatedAt"> & {
  _id: string;
  startDate: string | null;
  endDate: string | null;
  creators: CampaignCreatorDTO[];
  createdAt: string;
  updatedAt: string;
};

export interface CampaignSummary {
  creatorCount: number;
  byStatus: Record<string, number>;
  totalReach: number;
  agreedSpend: number;
  paidSpend: number;
}

export type CampaignListDTO = CampaignDTO & { summary: CampaignSummary };

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
