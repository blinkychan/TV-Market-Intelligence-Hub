export type BuyerProjectSummary = {
  id: string;
  title: string;
  status: string;
  genre: string | null;
  type: string;
  studio: string | null;
  productionCompanies: string[];
  people: string[];
  countryOfOrigin: string | null;
  isInternational: boolean;
  isCoProduction: boolean;
  isAcquisition: boolean;
  announcementDate: string | null;
  lastUpdateDate: string | null;
  sourceUrl: string | null;
  notes: string | null;
};

export type BuyerProject = BuyerProjectSummary;

export type BuyerCurrentShowSummary = {
  id: string;
  title: string;
  networkOrPlatform: string;
  premiereDate: string | null;
  finaleDate: string | null;
  seasonNumber: number | null;
  episodeCount: number | null;
  status: string;
  genre: string | null;
  studio: string | null;
  productionCompanies: string | null;
  country: string | null;
  sourceUrl: string | null;
  notes: string | null;
};

export type BuyerCurrentShow = BuyerCurrentShowSummary;

export type BuyerCompanySummary = {
  id: string;
  name: string;
  type: string;
};

export type BuyerPersonSummary = {
  id: string;
  name: string;
  role: string;
};

export type BuyerRelationshipSummary = {
  id: string;
  relationshipType: string;
  buyerId: string | null;
  companyId: string | null;
  personId: string | null;
  projectId: string | null;
  sourceUrl: string | null;
  date: string | null;
};

export type BuyerDetailData = {
  id: string;
  name: string;
  type: string;
  parentCompany: string | null;
  notes: string | null;
  projects: BuyerProjectSummary[];
  currentShows: BuyerCurrentShowSummary[];
  companies?: BuyerCompanySummary[];
  people?: BuyerPersonSummary[];
  relationships?: BuyerRelationshipSummary[];
};

export type BuyerListItem = {
  id: string;
  name: string;
  type: string;
  parentCompany: string | null;
  notes: string | null;
  projectCount: number;
  currentShowCount: number;
  acquisitionCount: number;
  internationalCount: number;
  staleCount: number;
};
