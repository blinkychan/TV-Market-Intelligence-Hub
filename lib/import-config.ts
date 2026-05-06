export const IMPORT_ENTITY_OPTIONS = ["projects", "current-shows", "buyers", "companies", "people", "articles"] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_OPTIONS)[number];

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  candidates: string[];
};

const IMPORT_FIELD_MAP: Record<ImportEntityType, ImportField[]> = {
  projects: [
    { key: "title", label: "Title", required: true, candidates: ["title", "project", "series", "name"] },
    { key: "type", label: "Type", required: true, candidates: ["type", "projecttype"] },
    { key: "status", label: "Status", required: true, candidates: ["status", "projectstatus"] },
    { key: "buyer", label: "Buyer", candidates: ["buyer", "network", "platform", "networkorplatform"] },
    { key: "studio", label: "Studio", candidates: ["studio"] },
    { key: "productionCompanies", label: "Production Companies", candidates: ["productioncompanies", "prodcos", "productioncompany"] },
    { key: "people", label: "People", candidates: ["people", "talent", "creators"] },
    { key: "genre", label: "Genre", candidates: ["genre"] },
    { key: "countryOfOrigin", label: "Country", candidates: ["country", "countryoforigin"] },
    { key: "announcementDate", label: "Announcement Date", candidates: ["announcementdate", "announced", "date"] },
    { key: "sourceUrl", label: "Source URL", candidates: ["sourceurl", "url"] },
    { key: "notes", label: "Notes", candidates: ["notes", "summary"] }
  ],
  "current-shows": [
    { key: "title", label: "Title", required: true, candidates: ["title", "showtitle", "series"] },
    { key: "networkOrPlatform", label: "Network / Platform", required: true, candidates: ["network", "platform", "networkorplatform"] },
    { key: "premiereDate", label: "Premiere Date", candidates: ["premieredate", "premiere"] },
    { key: "finaleDate", label: "Finale Date", candidates: ["finaledate", "finale"] },
    { key: "status", label: "Status", required: true, candidates: ["status"] },
    { key: "genre", label: "Genre", candidates: ["genre"] },
    { key: "studio", label: "Studio", candidates: ["studio"] },
    { key: "country", label: "Country", candidates: ["country"] },
    { key: "seasonType", label: "Season Type", candidates: ["seasontype"] },
    { key: "sourceUrl", label: "Source URL", candidates: ["sourceurl", "url"] },
    { key: "notes", label: "Notes", candidates: ["notes", "summary"] }
  ],
  buyers: [
    { key: "name", label: "Name", required: true, candidates: ["name", "buyer"] },
    { key: "type", label: "Type", required: true, candidates: ["type", "buyertype"] },
    { key: "parentCompany", label: "Parent Company", candidates: ["parentcompany", "parent"] },
    { key: "notes", label: "Notes", candidates: ["notes"] }
  ],
  companies: [
    { key: "name", label: "Name", required: true, candidates: ["name", "company"] },
    { key: "type", label: "Type", required: true, candidates: ["type", "companytype"] },
    { key: "notes", label: "Notes", candidates: ["notes"] }
  ],
  people: [
    { key: "name", label: "Name", required: true, candidates: ["name", "person"] },
    { key: "role", label: "Role", required: true, candidates: ["role", "personrole"] },
    { key: "company", label: "Company", candidates: ["company"] },
    { key: "reps", label: "Reps", candidates: ["reps", "representation"] },
    { key: "notes", label: "Notes", candidates: ["notes"] }
  ],
  articles: [
    { key: "headline", label: "Headline", required: true, candidates: ["headline", "title"] },
    { key: "url", label: "URL", required: true, candidates: ["url", "sourceurl", "link"] },
    { key: "publication", label: "Publication", candidates: ["publication", "source"] },
    { key: "publishedDate", label: "Published Date", candidates: ["publisheddate", "date"] },
    { key: "summary", label: "Summary", candidates: ["summary", "notes"] },
    { key: "suspectedCategory", label: "Suspected Category", candidates: ["suspectedcategory", "category"] }
  ]
};

export function getImportFields(entityType: ImportEntityType) {
  return IMPORT_FIELD_MAP[entityType];
}

export function guessCsvMapping(entityType: ImportEntityType, headers: string[]) {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const mapping: Record<string, string> = {};

  for (const field of IMPORT_FIELD_MAP[entityType]) {
    const header = headers[normalized.findIndex((item) => field.candidates.includes(item))] ?? "";
    mapping[field.key] = header;
  }

  return mapping;
}
