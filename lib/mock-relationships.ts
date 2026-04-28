import type { CompanyDetailData, PersonDetailData, RelationshipIndexData } from "@/components/relationships/types";

export const mockCompanyDetails: CompanyDetailData[] = [
  {
    id: "mock-company-a24",
    name: "A24 Television",
    type: "studio",
    notes: "Mock premium studio profile.",
    projects: [
      {
        id: "mock-harbor-lights",
        title: "Harbor Lights",
        status: "sold",
        genre: "Crime Drama",
        buyerId: "mock-netflix",
        buyer: "Netflix",
        studioId: "mock-company-a24",
        studio: "A24 Television",
        productionCompanies: [{ id: "mock-company-wiip", name: "wiip" }],
        people: [{ id: "mock-person-maya", name: "Maya Rivers", role: "creator" }],
        isAcquisition: false,
        isCoProduction: false,
        isInternational: false,
        announcementDate: "2026-04-21T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/harbor-lights"
      }
    ]
  },
  {
    id: "mock-company-wiip",
    name: "wiip",
    type: "production_company",
    notes: "Mock independent producer profile.",
    projects: []
  }
];

export const mockPersonDetails: PersonDetailData[] = [
  {
    id: "mock-person-maya",
    name: "Maya Rivers",
    role: "creator",
    company: "Rivers Room",
    reps: "UTA / Grandview",
    notes: "Mock creator profile.",
    projects: mockCompanyDetails[0].projects
  }
];

export const mockRelationshipIndex: RelationshipIndexData = {
  companies: mockCompanyDetails.map((company) => ({
    id: company.id,
    name: company.name,
    type: company.type,
    projectCount: company.projects.length,
    connectedBuyers: Array.from(new Set(company.projects.map((project) => project.buyer).filter(Boolean) as string[])),
    connectedPeople: Array.from(new Set(company.projects.flatMap((project) => project.people.map((person) => person.name))))
  })),
  people: mockPersonDetails.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    company: person.company,
    reps: person.reps,
    projectCount: person.projects.length,
    connectedBuyers: Array.from(new Set(person.projects.map((project) => project.buyer).filter(Boolean) as string[])),
    connectedCompanies: Array.from(new Set(person.projects.flatMap((project) => [project.studio, ...project.productionCompanies.map((company) => company.name)]).filter(Boolean) as string[]))
  })),
  nodes: [
    { id: "mock-netflix", label: "Netflix", type: "buyer", href: "/buyers/mock-netflix" },
    { id: "mock-company-a24", label: "A24 Television", type: "company", href: "/companies/mock-company-a24" },
    { id: "mock-company-wiip", label: "wiip", type: "company", href: "/companies/mock-company-wiip" },
    { id: "mock-person-maya", label: "Maya Rivers", type: "person", href: "/talent/mock-person-maya" },
    { id: "mock-harbor-lights", label: "Harbor Lights", type: "project" }
  ],
  edges: [
    { from: "mock-netflix", to: "mock-harbor-lights", projectId: "mock-harbor-lights", projectStatus: "sold", year: "2026" },
    { from: "mock-company-a24", to: "mock-harbor-lights", projectId: "mock-harbor-lights", projectStatus: "sold", year: "2026" },
    { from: "mock-company-wiip", to: "mock-harbor-lights", projectId: "mock-harbor-lights", projectStatus: "sold", year: "2026" },
    { from: "mock-person-maya", to: "mock-harbor-lights", projectId: "mock-harbor-lights", projectStatus: "sold", year: "2026" }
  ]
};
