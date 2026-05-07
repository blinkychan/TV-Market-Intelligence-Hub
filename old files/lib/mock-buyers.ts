import type { BuyerDetailData, BuyerListItem } from "@/components/buyers/types";
import { mockCurrentShows } from "@/lib/mock-current-tv";

export const mockBuyerDetails: BuyerDetailData[] = [
  {
    id: "mock-netflix",
    name: "Netflix",
    type: "streamer",
    parentCompany: "Netflix, Inc.",
    notes: "Mock preview buyer with a global scripted and international profile.",
    currentShows: mockCurrentShows.filter((show) => show.networkOrPlatform === "Netflix"),
    projects: [
      {
        id: "mock-harbor-lights",
        title: "Harbor Lights",
        status: "sold",
        genre: "Crime Drama",
        type: "scripted",
        studio: "A24 Television",
        productionCompanies: ["wiip"],
        people: ["Maya Rivers", "Noor Hassan"],
        countryOfOrigin: "United States",
        isInternational: false,
        isCoProduction: false,
        isAcquisition: false,
        announcementDate: "2026-04-21T12:00:00.000Z",
        lastUpdateDate: "2026-04-21T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/harbor-lights",
        notes: "Mock buyer project."
      },
      {
        id: "mock-sleep-index",
        title: "The Sleep Index",
        status: "passed",
        genre: "Sci-Fi Thriller",
        type: "scripted",
        studio: "Warner Bros. Television",
        productionCompanies: ["Tomorrow Studios"],
        people: ["Noor Hassan"],
        countryOfOrigin: "United States",
        isInternational: false,
        isCoProduction: false,
        isAcquisition: false,
        announcementDate: "2025-07-15T12:00:00.000Z",
        lastUpdateDate: "2025-07-15T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/the-sleep-index",
        notes: "Mock buyer project."
      }
    ]
  },
  {
    id: "mock-abc",
    name: "ABC",
    type: "broadcast",
    parentCompany: "Disney",
    notes: "Mock preview buyer with broad broadcast development.",
    currentShows: mockCurrentShows.filter((show) => show.networkOrPlatform === "ABC"),
    projects: [
      {
        id: "mock-format-lab",
        title: "The Format Lab",
        status: "pilot_order",
        genre: "Competition",
        type: "format",
        studio: "Universal Television",
        productionCompanies: ["Left/Right"],
        people: ["Priya Raman"],
        countryOfOrigin: "United States",
        isInternational: false,
        isCoProduction: false,
        isAcquisition: false,
        announcementDate: "2026-03-18T12:00:00.000Z",
        lastUpdateDate: "2026-03-18T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/the-format-lab",
        notes: "Mock buyer project."
      },
      {
        id: "mock-fourth-estate",
        title: "Fourth Estate",
        status: "sold",
        genre: "Workplace Drama",
        type: "scripted",
        studio: "20th Television",
        productionCompanies: ["wiip"],
        people: ["Maya Rivers", "Marcus Bell"],
        countryOfOrigin: "United States",
        isInternational: false,
        isCoProduction: false,
        isAcquisition: false,
        announcementDate: "2026-04-04T12:00:00.000Z",
        lastUpdateDate: "2026-04-04T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/fourth-estate",
        notes: "Mock buyer project."
      }
    ]
  },
  {
    id: "mock-bbc",
    name: "BBC",
    type: "broadcast",
    parentCompany: "BBC",
    notes: "Mock preview buyer with international co-production activity.",
    currentShows: mockCurrentShows.filter((show) => show.networkOrPlatform === "BBC"),
    projects: [
      {
        id: "mock-northern-exchange",
        title: "Northern Exchange",
        status: "series_order",
        genre: "Thriller",
        type: "co_production",
        studio: "Universal Television",
        productionCompanies: ["Bad Wolf"],
        people: ["Lena Ortiz", "Graham Pike"],
        countryOfOrigin: "United Kingdom",
        isInternational: true,
        isCoProduction: true,
        isAcquisition: false,
        announcementDate: "2026-04-24T12:00:00.000Z",
        lastUpdateDate: "2026-04-24T12:00:00.000Z",
        sourceUrl: "https://example.com/projects/northern-exchange",
        notes: "Mock co-production project."
      }
    ]
  },
  {
    id: "mock-peacock",
    name: "Peacock",
    type: "streamer",
    parentCompany: "NBCUniversal",
    notes: "Mock preview buyer with broad streaming and unscripted activity.",
    currentShows: mockCurrentShows.filter((show) => show.networkOrPlatform === "Peacock"),
    projects: []
  },
  {
    id: "mock-fx",
    name: "FX",
    type: "cable",
    parentCompany: "Disney",
    notes: "Mock preview buyer with auteur-driven scripted activity.",
    currentShows: mockCurrentShows.filter((show) => show.networkOrPlatform === "FX"),
    projects: []
  }
];

export const mockBuyerList: BuyerListItem[] = mockBuyerDetails.map((buyer) => ({
  id: buyer.id,
  name: buyer.name,
  type: buyer.type,
  parentCompany: buyer.parentCompany,
  notes: buyer.notes,
  projectCount: buyer.projects.length,
  currentShowCount: buyer.currentShows.length,
  acquisitionCount: buyer.projects.filter((project) => project.isAcquisition).length,
  internationalCount: buyer.projects.filter((project) => project.isInternational || project.isCoProduction).length,
  staleCount: buyer.projects.filter((project) => project.status === "stale").length
}));
