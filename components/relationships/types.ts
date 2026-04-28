export type RelationshipProject = {
  id: string;
  title: string;
  status: string;
  genre: string | null;
  buyerId: string | null;
  buyer: string | null;
  studioId: string | null;
  studio: string | null;
  productionCompanies: { id: string; name: string }[];
  people: { id: string; name: string; role: string }[];
  isAcquisition: boolean;
  isCoProduction: boolean;
  isInternational: boolean;
  announcementDate: string | null;
  sourceUrl: string | null;
};

export type CompanyListItem = {
  id: string;
  name: string;
  type: string;
  projectCount: number;
  connectedBuyers: string[];
  connectedPeople: string[];
};

export type PersonListItem = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  reps: string | null;
  projectCount: number;
  connectedBuyers: string[];
  connectedCompanies: string[];
};

export type NetworkNode = {
  id: string;
  label: string;
  type: "buyer" | "company" | "person" | "project";
  href?: string;
};

export type NetworkEdge = {
  from: string;
  to: string;
  projectId?: string;
  projectStatus?: string;
  year?: string;
};

export type RelationshipIndexData = {
  companies: CompanyListItem[];
  people: PersonListItem[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

export type CompanyDetailData = {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  projects: RelationshipProject[];
};

export type PersonDetailData = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  reps: string | null;
  notes: string | null;
  projects: RelationshipProject[];
};
