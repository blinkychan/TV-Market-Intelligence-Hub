import type { DuplicateGroup } from "@/lib/deduplication";

export const mockDuplicateGroups: DuplicateGroup[] = [
  {
    id: "article-harbor-lights",
    entityType: "article",
    label: "Harbor Lights",
    confidence: 0.91,
    reason: "very close title/name match; same buyer/platform; close dates",
    records: [
      {
        id: "mock-article-1",
        entityType: "article",
        label: "Harbor Lights",
        url: "https://preview.example.com/harbor-lights",
        buyerOrPlatform: "Netflix",
        studioOrCompany: "A24 Television",
        date: "2026-04-21T12:00:00.000Z",
        aliases: "Harbour Lights",
        confidenceScore: 0.89,
        duplicateGroupId: "article-harbor-lights",
        duplicateStatus: "not_duplicate",
        payload: {
          headline: "Netflix lands coastal crime drama Harbor Lights",
          publication: "Deadline",
          notes: "Original sale report with strongest detail set."
        }
      },
      {
        id: "mock-article-5",
        entityType: "article",
        label: "Harbor Lights",
        url: "https://preview.example.com/harbor-lights-duplicate",
        buyerOrPlatform: "Netflix",
        studioOrCompany: "A24 Television",
        date: "2026-04-22T12:00:00.000Z",
        aliases: "Harbour Lights sale",
        confidenceScore: 0.51,
        duplicateGroupId: "article-harbor-lights",
        duplicateStatus: "confirmed_duplicate",
        payload: {
          headline: "Harbor Lights sale item repeated by follow-up brief",
          publication: "TVLine",
          notes: "Follow-up brief with limited net new information."
        }
      }
    ]
  },
  {
    id: "project-harbor-lights",
    entityType: "project",
    label: "Harbor Lights",
    confidence: 0.9,
    reason: "very close title/name match; same buyer/platform; close dates; same studio/company",
    records: [
      {
        id: "mock-project-harbor-lights",
        entityType: "project",
        label: "Harbor Lights",
        url: "https://example.com/projects/harbor-lights",
        buyerOrPlatform: "Netflix",
        studioOrCompany: "A24 Television",
        date: "2026-04-21T12:00:00.000Z",
        aliases: "Harbour Lights",
        confidenceScore: 0.86,
        duplicateGroupId: "project-harbor-lights",
        duplicateStatus: "not_duplicate",
        payload: {
          status: "sold",
          type: "scripted",
          notes: "Original project card."
        }
      },
      {
        id: "mock-project-harbour-lights",
        entityType: "project",
        label: "Harbour Lights",
        url: "https://example.com/projects/harbour-lights",
        buyerOrPlatform: "Netflix",
        studioOrCompany: "A24 Television",
        date: "2026-04-22T12:00:00.000Z",
        aliases: "Harbor Lights",
        confidenceScore: 0.62,
        duplicateGroupId: "project-harbor-lights",
        duplicateStatus: "possible_duplicate",
        payload: {
          status: "sold",
          type: "scripted",
          notes: "Alternate spelling from follow-up ingest."
        }
      }
    ]
  },
  {
    id: "company-wbtv",
    entityType: "company",
    label: "Warner Bros. Television",
    confidence: 0.87,
    reason: "similar title/name; same duplicate group",
    records: [
      {
        id: "mock-company-wbtv-full",
        entityType: "company",
        label: "Warner Bros. Television",
        studioOrCompany: "studio",
        aliases: "WBTV",
        confidenceScore: 0.88,
        duplicateGroupId: "company-wbtv",
        duplicateStatus: "not_duplicate",
        payload: { type: "studio", notes: "Canonical long-form company name." }
      },
      {
        id: "mock-company-wbtv",
        entityType: "company",
        label: "WBTV",
        studioOrCompany: "studio",
        aliases: "Warner Bros. Television",
        confidenceScore: 0.72,
        duplicateGroupId: "company-wbtv",
        duplicateStatus: "possible_duplicate",
        payload: { type: "studio", notes: "Short-form alias from manual entry." }
      }
    ]
  },
  {
    id: "person-maya-rivers",
    entityType: "person",
    label: "Maya Rivers",
    confidence: 0.84,
    reason: "similar title/name; same company; same duplicate group",
    records: [
      {
        id: "mock-person-maya",
        entityType: "person",
        label: "Maya Rivers",
        studioOrCompany: "Rivers Room",
        aliases: "Maya R. Rivers",
        confidenceScore: 0.86,
        duplicateGroupId: "person-maya-rivers",
        duplicateStatus: "not_duplicate",
        payload: { role: "creator", notes: "Canonical talent record." }
      },
      {
        id: "mock-person-maya-alt",
        entityType: "person",
        label: "Maya R. Rivers",
        studioOrCompany: "Rivers Room",
        aliases: "Maya Rivers",
        confidenceScore: 0.73,
        duplicateGroupId: "person-maya-rivers",
        duplicateStatus: "possible_duplicate",
        payload: { role: "creator", notes: "Short-credit variant from ingest." }
      }
    ]
  }
];
