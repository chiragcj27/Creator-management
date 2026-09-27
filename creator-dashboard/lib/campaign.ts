import type { Campaign, CampaignCreator } from "./types";

export function newCampaign(name: string): Campaign {
  const now = new Date();
  return {
    name,
    brand: null,
    description: "",
    status: "Planning",
    startDate: null,
    endDate: null,
    budget: null,
    platforms: [],
    targetGenres: [],
    creators: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function newCampaignCreator(handle: string): CampaignCreator {
  return {
    handle,
    status: "Shortlisted",
    rate: null,
    paid: false,
    deliverables: [],
    notes: "",
    addedAt: new Date(),
  };
}
