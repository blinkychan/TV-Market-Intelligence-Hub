export type BuyerProject = {
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

export type BuyerCurrentShow = {
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

export type BuyerDetailData = {
  id: string;
  name: string;
  type: string;
  parentCompany: string | null;
  notes: string | null;
  projects: BuyerProject[];
  currentShows: BuyerCurrentShow[];
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
