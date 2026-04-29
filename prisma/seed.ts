import { Prisma, PrismaClient } from "@prisma/client";
import { defaultCurrentTvSources } from "../lib/current-tv-sources";
import { inferSourceReliability } from "../lib/source-reliability";

const prisma = new PrismaClient();

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

async function main() {
  await prisma.relationship.deleteMany();
  await prisma.backfillJob.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.teamNote.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.rssFeed.deleteMany();
  await prisma.currentTvSource.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.article.deleteMany();
  await prisma.currentShow.deleteMany();
  await prisma.project.deleteMany();
  await prisma.person.deleteMany();
  await prisma.company.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.userProfile.deleteMany();

  const buyers = await Promise.all(
    ([
      { name: "Netflix", type: "streamer", parentCompany: "Netflix, Inc.", notes: "Global scripted, unscripted, and international buyer." },
      { name: "HBO", type: "cable", parentCompany: "Warner Bros. Discovery", notes: "Premium scripted and limited series buyer." },
      { name: "ABC", type: "broadcast", parentCompany: "Disney", notes: "Broadcast drama, comedy, and unscripted formats." },
      { name: "FX", type: "cable", parentCompany: "Disney", notes: "Auteur-driven scripted and limited series." },
      { name: "Peacock", type: "streamer", parentCompany: "NBCUniversal", notes: "Broad commercial streaming buyer." },
      { name: "Apple TV+", type: "streamer", parentCompany: "Apple", notes: "Premium global scripted and documentary buyer." },
      { name: "Apple TV Plus", type: "streamer", parentCompany: "Apple", notes: "Alias-heavy duplicate candidate for Apple TV+.", aliases: "AppleTV+" as string, duplicateGroupId: "buyer-apple-tv", duplicateConfidence: 0.82, possibleDuplicateOfId: null, duplicateStatus: "possible_duplicate" as const },
      { name: "BBC", type: "broadcast", parentCompany: "BBC", notes: "UK broadcaster and co-production partner." },
      { name: "Fremantle", type: "distributor", parentCompany: "RTL Group", notes: "International distributor and format partner." }
    ] as const).map((item) => prisma.buyer.create({ data: item }))
  );

  const buyerByName = Object.fromEntries(buyers.map((buyer) => [buyer.name, buyer]));

  const companies = await Promise.all(
    ([
      { name: "Universal Television", type: "studio", notes: "Major US television studio." },
      { name: "A24 Television", type: "studio", notes: "Premium studio for talent-driven packages." },
      { name: "20th Television", type: "studio", notes: "Disney-owned television studio." },
      { name: "Warner Bros. Television", type: "studio", notes: "Large scripted television supplier." },
      { name: "WBTV", type: "studio", notes: "Common short-form alias for Warner Bros. Television.", aliases: "Warner Bros. Television" as string, duplicateGroupId: "company-wbtv", duplicateConfidence: 0.87, possibleDuplicateOfId: null, duplicateStatus: "possible_duplicate" as const },
      { name: "wiip", type: "production_company", notes: "Independent studio and production company." },
      { name: "Bad Wolf", type: "production_company", notes: "UK scripted producer with co-production experience." },
      { name: "Left/Right", type: "production_company", notes: "Unscripted and documentary producer." },
      { name: "Tomorrow Studios", type: "production_company", notes: "Scripted production company with international adaptations." },
      { name: "CAA", type: "agency", notes: "Talent agency." },
      { name: "Grandview", type: "management_company", notes: "Management company." }
    ] as const).map((item) => prisma.company.create({ data: item }))
  );

  const companyByName = Object.fromEntries(companies.map((company) => [company.name, company]));

  const people = await Promise.all(
    ([
      { name: "Maya Rivers", role: "creator", company: "Rivers Room", reps: "UTA / Grandview", notes: "Drama creator." },
      { name: "Lena Ortiz", role: "showrunner", company: "Independent", reps: "CAA", notes: "Premium limited-series showrunner." },
      { name: "Noor Hassan", role: "writer", company: "Independent", reps: "WME", notes: "Crime and thriller writer." },
      { name: "Graham Pike", role: "producer", company: "Bad Wolf", reps: "Independent Talent", notes: "UK co-production producer." },
      { name: "Elise Cho", role: "executive", company: "A24 Television", reps: null, notes: "Studio executive." },
      { name: "Jonah Vale", role: "director", company: "Independent", reps: "CAA", notes: "Pilot and limited-series director." },
      { name: "Priya Raman", role: "producer", company: "Tomorrow Studios", reps: "Grandview", notes: "International format producer." },
      { name: "Caleb Stone", role: "actor", company: "Independent", reps: "CAA", notes: "Lead talent attachment." },
      { name: "Rina Sato", role: "creator", company: "Independent", reps: "WME", notes: "Animation and genre creator." },
      { name: "Marcus Bell", role: "showrunner", company: "Independent", reps: "UTA", notes: "Broadcast procedural showrunner." },
      { name: "Maya R. Rivers", role: "creator", company: "Rivers Room", reps: "UTA / Grandview", notes: "Possible duplicate short-form credit for Maya Rivers.", aliases: "Maya Rivers" as string, duplicateGroupId: "person-maya-rivers", duplicateConfidence: 0.84, possibleDuplicateOfId: null, duplicateStatus: "possible_duplicate" as const }
    ] as const).map((item) => prisma.person.create({ data: item }))
  );

  const personByName = Object.fromEntries(people.map((person) => [person.name, person]));

  const projectSpecs = [
    {
      title: "Harbor Lights",
      type: "scripted",
      status: "sold",
      buyer: "Netflix",
      studio: "A24 Television",
      prodcos: ["wiip"],
      people: ["Maya Rivers", "Noor Hassan"],
      genre: "Crime Drama",
      country: "United States",
      announced: "2026-04-21",
      aliases: "Harbour Lights",
      logline: "A coastal medical examiner uncovers a shipping conspiracy while rebuilding ties with her hometown."
    },
    {
      title: "Harbour Lights",
      type: "scripted",
      status: "sold",
      buyer: "Netflix",
      studio: "A24 Television",
      prodcos: ["wiip"],
      people: ["Maya R. Rivers"],
      genre: "Crime Drama",
      country: "United States",
      announced: "2026-04-22",
      aliases: "Harbor Lights",
      needsReview: true,
      duplicateGroupId: "project-harbor-lights",
      duplicateConfidence: 0.9,
      duplicateStatus: "possible_duplicate",
      logline: "Alternate-market spelling of a coastal crime package sale item."
    },
    {
      title: "Northern Exchange",
      type: "co_production",
      status: "series_order",
      buyer: "BBC",
      studio: "Universal Television",
      prodcos: ["Bad Wolf"],
      people: ["Lena Ortiz", "Graham Pike"],
      genre: "Thriller",
      country: "United Kingdom",
      announced: "2026-04-24",
      isInternational: true,
      isCoProduction: true,
      logline: "A London fixer and Toronto prosecutor collide on a politically explosive extradition case."
    },
    {
      title: "The Format Lab",
      type: "format",
      status: "pilot_order",
      buyer: "ABC",
      studio: "Universal Television",
      prodcos: ["Left/Right"],
      people: ["Priya Raman"],
      genre: "Competition",
      country: "United States",
      announced: "2026-03-18",
      needsReview: true,
      logline: "Contestants rework failed consumer products into live shopping hits."
    },
    {
      title: "Glass Embassy",
      type: "acquisition",
      status: "stale",
      buyer: "HBO",
      studio: "A24 Television",
      prodcos: ["wiip"],
      people: ["Lena Ortiz"],
      genre: "Political Drama",
      country: "Denmark",
      announced: "2025-11-13",
      isInternational: true,
      isAcquisition: true,
      acquisitionDetails: "US adaptation rights acquired from Nordic distributor.",
      logline: "A Scandinavian political drama package is acquired for US adaptation."
    },
    {
      title: "Skyline Unit",
      type: "scripted",
      status: "in_development",
      buyer: "FX",
      studio: "20th Television",
      prodcos: ["Tomorrow Studios"],
      people: ["Marcus Bell", "Jonah Vale"],
      genre: "Procedural",
      country: "United States",
      announced: "2026-01-29",
      logline: "A city infrastructure task force solves crimes hidden inside public systems."
    },
    {
      title: "Moonbase Kitchen",
      type: "unscripted",
      status: "sold",
      buyer: "Peacock",
      studio: "Universal Television",
      prodcos: ["Left/Right"],
      people: ["Priya Raman"],
      genre: "Food Competition",
      country: "United States",
      announced: "2026-02-14",
      logline: "Chefs build menus for simulated off-world missions."
    },
    {
      title: "Paper Kingdom",
      type: "animation",
      status: "series_order",
      buyer: "Apple TV+",
      studio: "A24 Television",
      prodcos: ["Tomorrow Studios"],
      people: ["Rina Sato"],
      genre: "Family Animation",
      country: "Japan",
      announced: "2026-02-26",
      isInternational: true,
      aliases: "The Paper Kingdom",
      logline: "A young cartographer enters a folded paper world where maps change the laws of nature."
    },
    {
      title: "The Witness Chair",
      type: "limited_series",
      status: "pilot_order",
      buyer: "HBO",
      studio: "Warner Bros. Television",
      prodcos: ["A24 Television"],
      people: ["Lena Ortiz", "Caleb Stone"],
      genre: "Legal Thriller",
      country: "United States",
      announced: "2026-03-07",
      logline: "A famous actor becomes the key witness in a case that reopens a studio-era disappearance."
    },
    {
      title: "Port of Call",
      type: "international",
      status: "in_development",
      buyer: "Fremantle",
      studio: "Universal Television",
      prodcos: ["Bad Wolf"],
      people: ["Graham Pike"],
      genre: "Mystery",
      country: "Australia",
      announced: "2025-09-09",
      isInternational: true,
      logline: "A port authority investigator tracks crimes across a rotating cast of ships and crews."
    },
    {
      title: "Fourth Estate",
      type: "scripted",
      status: "sold",
      buyer: "ABC",
      studio: "20th Television",
      prodcos: ["wiip"],
      people: ["Maya Rivers", "Marcus Bell"],
      genre: "Workplace Drama",
      country: "United States",
      announced: "2026-04-04",
      logline: "A local newsroom fights for relevance after a private equity takeover."
    },
    {
      title: "The Sleep Index",
      type: "scripted",
      status: "passed",
      buyer: "Netflix",
      studio: "Warner Bros. Television",
      prodcos: ["Tomorrow Studios"],
      people: ["Noor Hassan"],
      genre: "Sci-Fi Thriller",
      country: "United States",
      announced: "2025-07-15",
      logline: "A sleep-tech startup discovers its dreams can predict public violence."
    },
    {
      title: "Dating the Archive",
      type: "unscripted",
      status: "in_development",
      buyer: "Peacock",
      studio: "Universal Television",
      prodcos: ["Left/Right"],
      people: ["Priya Raman"],
      genre: "Dating",
      country: "United States",
      announced: "2026-01-12",
      logline: "Singles reconstruct old missed connections from public archives and personal histories."
    },
    {
      title: "After Oslo",
      type: "co_production",
      status: "renewed",
      buyer: "BBC",
      studio: "Warner Bros. Television",
      prodcos: ["Bad Wolf"],
      people: ["Graham Pike", "Jonah Vale"],
      genre: "Spy Drama",
      country: "Norway",
      announced: "2025-12-02",
      isInternational: true,
      isCoProduction: true,
      logline: "A dormant intelligence pact resurfaces after a diplomat vanishes in Norway."
    },
    {
      title: "Open Tabs",
      type: "scripted",
      status: "canceled",
      buyer: "FX",
      studio: "20th Television",
      prodcos: ["wiip"],
      people: ["Maya Rivers"],
      genre: "Comedy",
      country: "United States",
      announced: "2024-10-21",
      logline: "A chaotic group of remote coworkers try to save a failing productivity startup."
    },
    {
      title: "Red Valley",
      type: "acquisition",
      status: "in_development",
      buyer: "Apple TV+",
      studio: "A24 Television",
      prodcos: ["Tomorrow Studios"],
      people: ["Rina Sato", "Caleb Stone"],
      genre: "Western",
      country: "Spain",
      announced: "2026-03-31",
      isInternational: true,
      isAcquisition: true,
      acquisitionDetails: "English-language remake rights acquired from Spanish format owner.",
      needsReview: true,
      logline: "A Spanish neo-western format is packaged for an English-language adaptation."
    }
  ] as const;

  const projects = [];
  for (const spec of projectSpecs) {
    projects.push(
      await prisma.project.create({
        data: {
          title: spec.title,
          aliases: "aliases" in spec ? spec.aliases : null,
          type: spec.type,
          status: spec.status,
          logline: spec.logline,
          genre: spec.genre,
          format: spec.type === "limited_series" ? "Limited series" : spec.type === "unscripted" || spec.type === "format" ? "Unscripted" : "One-hour",
          buyerId: buyerByName[spec.buyer].id,
          networkOrPlatform: spec.buyer,
          studioId: companyByName[spec.studio].id,
          productionCompanies: { connect: spec.prodcos.map((name) => ({ id: companyByName[name].id })) },
          people: { connect: spec.people.map((name) => ({ id: personByName[name].id })) },
          countryOfOrigin: spec.country,
          isInternational: "isInternational" in spec ? Boolean(spec.isInternational) : false,
          isCoProduction: "isCoProduction" in spec ? Boolean(spec.isCoProduction) : false,
          isAcquisition: "isAcquisition" in spec ? Boolean(spec.isAcquisition) : false,
          acquisitionDetails: "acquisitionDetails" in spec ? spec.acquisitionDetails : null,
          announcementDate: date(spec.announced),
          lastUpdateDate: date(spec.announced),
          sourceUrl: `https://example.com/projects/${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          sourcePublication: "Sample Trade",
          confidenceScore: "needsReview" in spec && spec.needsReview ? 0.62 : 0.86,
          duplicateGroupId: "duplicateGroupId" in spec ? spec.duplicateGroupId : null,
          duplicateConfidence: "duplicateConfidence" in spec ? spec.duplicateConfidence : null,
          possibleDuplicateOfId: null,
          duplicateStatus: "duplicateStatus" in spec ? spec.duplicateStatus : "not_duplicate",
          needsReview: "needsReview" in spec ? Boolean(spec.needsReview) : false,
          notes: "Seed data for local development."
        }
      })
    );
  }

  await prisma.currentShow.createMany({
    data: [
      { title: "City Desk", networkOrPlatform: "ABC", premiereDate: date("2026-04-29"), finaleDate: date("2026-06-24"), seasonNumber: 2, episodeCount: 10, status: "airing", genre: "Workplace Drama", studio: "20th Television", productionCompanies: "wiip", country: "United States", sourceType: "network_press", sourceReliability: "high", seasonType: "returning_series", premiereTime: "10:00 PM ET", episodeTitle: "The Tip Sheet", episodeNumber: 201, airPattern: "Wednesdays", verifiedAt: date("2026-04-25"), needsVerification: false, sourceUrl: "https://example.com/shows/city-desk" },
      { title: "Midnight Cartographers", networkOrPlatform: "Netflix", premiereDate: date("2026-05-01"), finaleDate: date("2026-05-01"), seasonNumber: 1, episodeCount: 8, status: "premiering soon", genre: "Fantasy", studio: "A24 Television", productionCompanies: "Tomorrow Studios", country: "United States", sourceType: "platform_press", sourceReliability: "high", seasonType: "new_series", premiereTime: "12:00 AM PT", episodeTitle: "Season Launch", episodeNumber: 101, airPattern: "Full season drop", verifiedAt: date("2026-04-26"), needsVerification: false, sourceUrl: "https://example.com/shows/midnight-cartographers" },
      { title: "Crown Evidence", networkOrPlatform: "BBC", premiereDate: date("2026-05-05"), finaleDate: date("2026-06-09"), seasonNumber: 1, episodeCount: 6, status: "premiering soon", genre: "Crime", studio: "Universal Television", productionCompanies: "Bad Wolf", country: "United Kingdom", sourceType: "network_press", sourceReliability: "high", seasonType: "new_series", premiereTime: "9:00 PM BST", episodeTitle: "First Evidence", episodeNumber: 101, airPattern: "Tuesdays", verifiedAt: date("2026-04-24"), needsVerification: false, sourceUrl: "https://example.com/shows/crown-evidence" },
      { title: "South Pier", aliases: "South Pier Season 3", networkOrPlatform: "HBO", premiereDate: date("2026-03-17"), finaleDate: date("2026-05-12"), seasonNumber: 3, episodeCount: 8, status: "airing", genre: "Drama", studio: "Warner Bros. Television", productionCompanies: "A24 Television", country: "United States", sourceType: "trade_roundup", sourceReliability: "medium", seasonType: "returning_series", premiereTime: "9:00 PM ET", episodeTitle: "The Tide Turns", episodeNumber: 307, airPattern: "Sundays", verifiedAt: date("2026-04-18"), needsVerification: false, sourceUrl: "https://example.com/shows/south-pier" },
      { title: "South Pier Season 3", aliases: "South Pier", networkOrPlatform: "HBO", premiereDate: date("2026-03-17"), finaleDate: date("2026-05-12"), seasonNumber: 3, episodeCount: 8, status: "airing", genre: "Drama", studio: "WBTV", productionCompanies: "A24 Television", country: "United States", sourceType: "trade_roundup", sourceReliability: "medium", seasonType: "returning_series", premiereTime: "9:00 PM ET", episodeTitle: "The Tide Turns", episodeNumber: 307, airPattern: "Sundays", verifiedAt: null, needsVerification: true, sourceUrl: "https://example.com/shows/south-pier-season-3", duplicateGroupId: "show-south-pier", duplicateConfidence: 0.88, possibleDuplicateOfId: null, duplicateStatus: "possible_duplicate" },
      { title: "The Orchard Trial", networkOrPlatform: "Apple TV+", premiereDate: date("2026-04-12"), finaleDate: date("2026-06-07"), seasonNumber: 1, episodeCount: 8, status: "airing", genre: "Legal Thriller", studio: "A24 Television", productionCompanies: "wiip", country: "United States", sourceType: "platform_press", sourceReliability: "high", seasonType: "limited_series", premiereTime: "12:00 AM PT", episodeTitle: "Voir Dire", episodeNumber: 104, airPattern: "Sundays", verifiedAt: date("2026-04-12"), needsVerification: false, sourceUrl: "https://example.com/shows/orchard-trial" },
      { title: "Food Court Kings", networkOrPlatform: "Peacock", premiereDate: date("2026-05-15"), finaleDate: date("2026-07-10"), seasonNumber: 2, episodeCount: 10, status: "returning", genre: "Food Competition", studio: "Universal Television", productionCompanies: "Left/Right", country: "United States", sourceType: "platform_press", sourceReliability: "high", seasonType: "returning_series", premiereTime: "8:00 PM ET", episodeTitle: "Kitchen Reopens", episodeNumber: 201, airPattern: "Fridays", verifiedAt: date("2026-04-21"), needsVerification: false, sourceUrl: "https://example.com/shows/food-court-kings" },
      { title: "Signal House", networkOrPlatform: "FX", premiereDate: date("2026-02-20"), finaleDate: date("2026-04-30"), seasonNumber: 1, episodeCount: 10, status: "finale soon", genre: "Spy Drama", studio: "20th Television", productionCompanies: "Tomorrow Studios", country: "United States", sourceType: "network_press", sourceReliability: "high", seasonType: "finale", premiereTime: "10:00 PM ET", episodeTitle: "Dead Drop", episodeNumber: 110, airPattern: "Thursdays", verifiedAt: date("2026-04-27"), needsVerification: true, sourceUrl: "https://example.com/shows/signal-house" },
      { title: "Blue Meridian", networkOrPlatform: "Netflix", premiereDate: date("2026-03-28"), finaleDate: date("2026-03-28"), seasonNumber: 1, episodeCount: 6, status: "airing", genre: "Mystery", studio: "Universal Television", productionCompanies: "Bad Wolf", country: "Australia", sourceType: "trade_roundup", sourceReliability: "medium", seasonType: "limited_series", premiereTime: "12:00 AM PT", episodeTitle: "Season Launch", episodeNumber: 101, airPattern: "Full season drop", verifiedAt: date("2026-03-27"), needsVerification: false, sourceUrl: "https://example.com/shows/blue-meridian" },
      { title: "Family Systems", networkOrPlatform: "ABC", premiereDate: date("2026-01-09"), finaleDate: date("2026-05-20"), seasonNumber: 4, episodeCount: 18, status: "airing", genre: "Family Drama", studio: "20th Television", productionCompanies: "Left/Right", country: "United States", sourceType: "network_press", sourceReliability: "high", seasonType: "returning_series", premiereTime: "8:00 PM ET", episodeTitle: "Parents' Night", episodeNumber: 416, airPattern: "Fridays", verifiedAt: date("2026-04-20"), needsVerification: false, sourceUrl: "https://example.com/shows/family-systems" },
      { title: "Animated Republic", networkOrPlatform: "Apple TV+", premiereDate: date("2026-06-03"), finaleDate: date("2026-07-22"), seasonNumber: 1, episodeCount: 8, status: "premiering soon", genre: "Animation", studio: "A24 Television", productionCompanies: "Tomorrow Studios", country: "Japan", sourceType: "platform_press", sourceReliability: "high", seasonType: "new_series", premiereTime: "12:00 AM PT", episodeTitle: "Pilot", episodeNumber: 101, airPattern: "Wednesdays", verifiedAt: null, needsVerification: true, sourceUrl: "https://example.com/shows/animated-republic" }
    ]
  });

  await prisma.currentTvSource.createMany({
    data: defaultCurrentTvSources.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      url: source.url,
      category: source.category,
      enabled: source.enabled,
      sourceReliability: source.sourceReliability,
      lastChecked: source.lastChecked ? date(source.lastChecked) : null,
      notes: source.notes
    }))
  });

  await prisma.article.createMany({
    data: [
      {
        url: "https://example.com/articles/harbor-lights",
        publication: "Sample Trade",
        headline: "Netflix buys Harbor Lights from A24 Television and wiip",
        publishedDate: date("2026-04-21"),
        summary: "A serialized crime drama package lands at Netflix with A24 Television and wiip producing.",
        aliases: "Harbour Lights",
        rawHtml: "<article><p>Netflix landed Harbor Lights from A24 Television and wiip with Maya Rivers and Noor Hassan attached.</p></article>",
        extractedText:
          "Netflix landed Harbor Lights from A24 Television and wiip with Maya Rivers and Noor Hassan attached. The package follows a medical examiner who uncovers a port corruption conspiracy.",
        extractedExcerpt: "Netflix landed Harbor Lights from A24 Television and wiip with Maya Rivers and Noor Hassan attached.",
        extractionMethod: "seed_readability",
        bodyFetchStatus: "success",
        bodyFetchError: null,
        bodyFetchedAt: date("2026-04-21"),
        robotsAllowed: true,
        paywallLikely: false,
        sourceReliability: inferSourceReliability("Sample Trade", "https://example.com/articles/harbor-lights"),
        needsReview: true,
        extractionStatus: "Needs Review",
        ingestionSource: "RSS",
        sourceType: "trade",
        suspectedCategory: "Sale",
        confidenceScore: 0.88,
        duplicateGroupId: "article-harbor-lights",
        duplicateConfidence: 0.91,
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        extractedProjectTitle: "Harbor Lights",
        extractedFormat: "One-hour drama",
        extractedStatus: "sold",
        extractedLogline: "A coastal medical examiner uncovers a shipping conspiracy while rebuilding ties with her hometown.",
        extractedBuyer: "Netflix",
        extractedStudio: "A24 Television",
        extractedCompanies: "wiip",
        extractedPeople: "Maya Rivers, Noor Hassan",
        extractedCountry: "United States",
        extractedAnnouncementDate: date("2026-04-21"),
        extractedRelationships: "Netflix <-> A24 Television <-> wiip <-> Maya Rivers"
      },
      {
        url: "https://example.com/articles/northern-exchange",
        publication: "Sample Trade",
        headline: "BBC and Universal set Northern Exchange co-production",
        publishedDate: date("2026-04-24"),
        summary: "BBC boards an international thriller co-production with Universal Television and Bad Wolf.",
        extractedExcerpt: "BBC boards an international thriller co-production with Universal Television and Bad Wolf.",
        bodyFetchStatus: "robots_blocked",
        bodyFetchError: "robots.txt disallows body fetch for this URL.",
        bodyFetchedAt: date("2026-04-24"),
        robotsAllowed: false,
        paywallLikely: false,
        sourceReliability: inferSourceReliability("Sample Trade", "https://example.com/articles/northern-exchange"),
        needsReview: false,
        extractionStatus: "Approved",
        ingestionSource: "RSS",
        sourceType: "trade",
        suspectedCategory: "Co-Production",
        confidenceScore: 0.93,
        extractedProjectTitle: "Northern Exchange",
        extractedFormat: "Drama series",
        extractedStatus: "series_order",
        extractedLogline: "A London fixer and Toronto prosecutor collide on a politically explosive extradition case.",
        extractedBuyer: "BBC",
        extractedStudio: "Universal Television",
        extractedCompanies: "Bad Wolf",
        extractedPeople: "Lena Ortiz, Graham Pike",
        extractedCountry: "United Kingdom",
        extractedAnnouncementDate: date("2026-04-24"),
        extractedRelationships: "BBC <-> Universal Television <-> Bad Wolf"
      },
      {
        url: "https://example.com/articles/red-valley",
        publication: "Sample Trade",
        headline: "Apple TV+ develops English-language Red Valley adaptation",
        publishedDate: date("2026-03-31"),
        summary: "An imported western format package is being reworked for Apple TV+ with a talent attachment.",
        extractedExcerpt: "Paywall likely. Only partial teaser content was available.",
        extractionMethod: "seed_paywall_detection",
        bodyFetchStatus: "paywall_likely",
        bodyFetchError: "Paywall likely; body text was not stored.",
        bodyFetchedAt: date("2026-03-31"),
        robotsAllowed: true,
        paywallLikely: true,
        sourceReliability: inferSourceReliability("Sample Trade", "https://example.com/articles/red-valley"),
        needsReview: true,
        extractionStatus: "New",
        ingestionSource: "RSS",
        sourceType: "trade",
        suspectedCategory: "Acquisition",
        confidenceScore: 0.74,
        extractedProjectTitle: "Red Valley",
        extractedFormat: "Drama series",
        extractedStatus: "in_development",
        extractedLogline: "A Spanish neo-western format is packaged for an English-language adaptation.",
        extractedBuyer: "Apple TV+",
        extractedStudio: "A24 Television",
        extractedCompanies: "Tomorrow Studios",
        extractedPeople: "Rina Sato, Caleb Stone",
        extractedCountry: "Spain",
        extractedAnnouncementDate: date("2026-03-31"),
        extractedRelationships: "Apple TV+ acquires remake rights with Tomorrow Studios producing"
      },
      {
        url: "https://example.com/articles/witness-chair",
        publication: "Sample Trade",
        headline: "Caleb Stone joins HBO legal thriller The Witness Chair",
        publishedDate: date("2026-03-08"),
        summary: "A lead acting attachment firms up HBO's limited-series package.",
        bodyFetchStatus: "timeout",
        bodyFetchError: "Timed out while fetching article HTML.",
        bodyFetchedAt: date("2026-03-08"),
        robotsAllowed: true,
        paywallLikely: false,
        sourceReliability: inferSourceReliability("Sample Trade", "https://example.com/articles/witness-chair"),
        needsReview: false,
        extractionStatus: "Rejected",
        ingestionSource: "RSS",
        sourceType: "trade",
        suspectedCategory: "Talent Attachment",
        confidenceScore: 0.67,
        extractedProjectTitle: "The Witness Chair",
        extractedFormat: "Limited series",
        extractedStatus: "pilot_order",
        extractedLogline: "A famous actor becomes the key witness in a case that reopens a studio-era disappearance.",
        extractedBuyer: "HBO",
        extractedStudio: "Warner Bros. Television",
        extractedCompanies: "A24 Television",
        extractedPeople: "Lena Ortiz, Caleb Stone",
        extractedCountry: "United States",
        extractedAnnouncementDate: date("2026-03-07"),
        extractedRelationships: "Caleb Stone joins Lena Ortiz package"
      },
      {
        url: "https://example.com/articles/harbor-lights-duplicate",
        publication: "Sample Trade",
        headline: "Harbor Lights sale makes Netflix move official",
        publishedDate: date("2026-04-22"),
        summary: "Follow-up item repeating the Harbor Lights sale with little incremental reporting.",
        aliases: "Harbour Lights sale",
        bodyFetchStatus: "fetch_error",
        bodyFetchError: "Fetch failed with 502.",
        bodyFetchedAt: date("2026-04-22"),
        robotsAllowed: true,
        paywallLikely: false,
        sourceReliability: inferSourceReliability("Sample Trade", "https://example.com/articles/harbor-lights-duplicate"),
        needsReview: false,
        extractionStatus: "Duplicate",
        ingestionSource: "RSS",
        sourceType: "trade",
        suspectedCategory: "Sale",
        confidenceScore: 0.52,
        duplicateGroupId: "article-harbor-lights",
        duplicateConfidence: 0.91,
        possibleDuplicateOfId: null,
        duplicateStatus: "confirmed_duplicate",
        extractedProjectTitle: "Harbor Lights",
        extractedFormat: "One-hour drama",
        extractedStatus: "sold",
        extractedBuyer: "Netflix",
        extractedStudio: "A24 Television",
        extractedCompanies: "wiip",
        extractedPeople: "Maya Rivers",
        extractedCountry: "United States",
        extractedAnnouncementDate: date("2026-04-22"),
        extractedRelationships: "Likely duplicate of prior Harbor Lights sale item"
      }
    ]
  });

  await prisma.article.update({
    where: { url: "https://example.com/articles/harbor-lights" },
    data: { linkedProjectId: projects.find((item) => item.title === "Harbor Lights")?.id }
  });

  await prisma.article.update({
    where: { url: "https://example.com/articles/northern-exchange" },
    data: { linkedProjectId: projects.find((item) => item.title === "Northern Exchange")?.id }
  });

  await prisma.article.update({
    where: { url: "https://example.com/articles/witness-chair" },
    data: { linkedProjectId: projects.find((item) => item.title === "The Witness Chair")?.id }
  });

  await prisma.article.update({
    where: { url: "https://example.com/articles/harbor-lights-duplicate" },
    data: { linkedProjectId: projects.find((item) => item.title === "Harbor Lights")?.id }
  });

  await prisma.buyer.update({
    where: { id: buyerByName["Apple TV Plus"].id },
    data: {
      possibleDuplicateOfId: buyerByName["Apple TV+"].id
    }
  });

  await prisma.company.update({
    where: { id: companyByName.WBTV.id },
    data: {
      possibleDuplicateOfId: companyByName["Warner Bros. Television"].id
    }
  });

  await prisma.person.update({
    where: { id: personByName["Maya R. Rivers"].id },
    data: {
      possibleDuplicateOfId: personByName["Maya Rivers"].id
    }
  });

  const harborLights = projects.find((item) => item.title === "Harbor Lights");
  const harbourLights = projects.find((item) => item.title === "Harbour Lights");
  if (harborLights && harbourLights) {
    await prisma.project.update({
      where: { id: harbourLights.id },
      data: {
        possibleDuplicateOfId: harborLights.id
      }
    });
  }

  const southPier = await prisma.currentShow.findFirst({ where: { title: "South Pier" }, select: { id: true } });
  const southPierSeason = await prisma.currentShow.findFirst({ where: { title: "South Pier Season 3" }, select: { id: true } });
  if (southPier && southPierSeason) {
    await prisma.currentShow.update({
      where: { id: southPierSeason.id },
      data: {
        possibleDuplicateOfId: southPier.id
      }
    });
  }

  const originalHarborArticle = await prisma.article.findUnique({
    where: { url: "https://example.com/articles/harbor-lights" },
    select: { id: true }
  });
  if (originalHarborArticle) {
    await prisma.article.update({
      where: { url: "https://example.com/articles/harbor-lights-duplicate" },
      data: {
        possibleDuplicateOfId: originalHarborArticle.id
      }
    });
  }

  await prisma.rssFeed.createMany({
    data: [
      { publicationName: "Deadline", feedUrl: "https://deadline.com/feed/", category: "Trades", enabled: true, lastChecked: date("2026-04-27") },
      { publicationName: "Variety", feedUrl: "https://variety.com/feed/", category: "Trades", enabled: true, lastChecked: date("2026-04-27") },
      { publicationName: "The Hollywood Reporter", feedUrl: "https://www.hollywoodreporter.com/feed/", category: "Trades", enabled: true, lastChecked: date("2026-04-26") },
      { publicationName: "TheWrap", feedUrl: "https://www.thewrap.com/feed/", category: "Trades", enabled: true, lastChecked: date("2026-04-24") },
      { publicationName: "TVLine", feedUrl: "https://tvline.com/feed/", category: "Trades", enabled: true, lastChecked: date("2026-04-25") },
      { publicationName: "ABC Press", feedUrl: "https://feeds.example.com/abc/press", category: "Network Press", enabled: false, lastChecked: date("2026-04-22") },
      { publicationName: "NBCUniversal Press", feedUrl: "https://feeds.example.com/nbcu/press", category: "Network Press", enabled: false, lastChecked: date("2026-04-20") },
      { publicationName: "BBC Press Office", feedUrl: "https://feeds.example.com/bbc/press", category: "Network Press", enabled: false, lastChecked: date("2026-04-21") }
    ]
  });

  await prisma.ingestionRun.createMany({
    data: [
      {
        sourceType: "rss_placeholder",
        sourceName: "Deadline",
        status: "completed",
        itemsFetched: 18,
        itemsSaved: 4,
        itemsSkipped: 14,
        startedAt: date("2026-04-27"),
        completedAt: date("2026-04-27"),
        notes: "Placeholder run for local preview."
      },
      {
        sourceType: "manual_url",
        sourceName: "Manual Article Entry",
        status: "queued",
        itemsFetched: 1,
        itemsSaved: 1,
        itemsSkipped: 0,
        startedAt: date("2026-04-26"),
        completedAt: date("2026-04-26"),
        notes: "Editor submitted article for review queue triage."
      },
      {
        sourceType: "backfill",
        sourceName: "2025 awards-season scan",
        status: "queued",
        itemsFetched: 0,
        itemsSaved: 0,
        itemsSkipped: 0,
        startedAt: date("2026-04-23"),
        completedAt: null,
        notes: "Queued historical scan for later batch processing."
      }
    ]
  });

  await prisma.backfillJob.createMany({
    data: [
      {
        source: "Deadline",
        year: 2024,
        month: 5,
        keywords: "Keyword Set: Script sale | script sale; series order; drama | Category: development",
        status: "queued",
        articlesFound: 0,
        articlesSaved: 0,
        duplicatesSkipped: 0,
        lastError: null
      },
      {
        source: "Variety",
        year: 2023,
        month: 11,
        keywords: "Keyword Set: Pilot order | pilot order; broadcast; family drama | Category: pilot order",
        status: "queued",
        articlesFound: 0,
        articlesSaved: 0,
        duplicatesSkipped: 0,
        lastError: null
      },
      {
        source: "The Hollywood Reporter",
        year: 2025,
        month: 2,
        keywords: "Keyword Set: International co-production | international co-production; thriller",
        status: "completed",
        articlesFound: 2,
        articlesSaved: 2,
        duplicatesSkipped: 0,
        lastError: null,
        completedAt: date("2026-04-22")
      }
    ]
  });

  for (const project of projects) {
    await prisma.relationship.create({
      data: {
        buyerId: project.buyerId,
        companyId: project.studioId,
        projectId: project.id,
        relationshipType: "buyer_studio_project",
        sourceUrl: project.sourceUrl,
        date: project.announcementDate
      }
    });
  }

  const relationshipSpecs = [
    ["Netflix", "wiip", "Maya Rivers", "Harbor Lights", "talent_attachment"],
    ["Netflix", "A24 Television", "Noor Hassan", "Harbor Lights", "writer_attachment"],
    ["BBC", "Bad Wolf", "Graham Pike", "Northern Exchange", "co_production_partner"],
    ["BBC", "Universal Television", "Lena Ortiz", "Northern Exchange", "showrunner_attachment"],
    ["ABC", "Left/Right", "Priya Raman", "The Format Lab", "format_producer"],
    ["HBO", "wiip", "Lena Ortiz", "Glass Embassy", "adaptation_package"],
    ["FX", "Tomorrow Studios", "Jonah Vale", "Skyline Unit", "director_attachment"],
    ["Peacock", "Left/Right", "Priya Raman", "Moonbase Kitchen", "producer_attachment"],
    ["Apple TV+", "Tomorrow Studios", "Rina Sato", "Paper Kingdom", "creator_attachment"],
    ["HBO", "Warner Bros. Television", "Caleb Stone", "The Witness Chair", "actor_attachment"]
  ];

  for (const [buyerName, companyName, personName, projectTitle, relationshipType] of relationshipSpecs) {
    const project = projects.find((item) => item.title === projectTitle);
    await prisma.relationship.create({
      data: {
        buyerId: buyerByName[buyerName].id,
        companyId: companyByName[companyName].id,
        personId: personByName[personName].id,
        projectId: project?.id,
        relationshipType,
        sourceUrl: project?.sourceUrl,
        date: project?.announcementDate
      }
    });
  }

  await prisma.weeklyReport.create({
    data: {
      weekStart: date("2026-04-20"),
      weekEnd: date("2026-04-26"),
      title: "Sample Weekly Report - April 24, 2026",
      generatedMarkdown: "# Sample Weekly Report\n\nSeed report placeholder for dashboard counts."
    }
  });

  await prisma.auditLog.createMany({
    data: [
      {
        entityType: "Article",
        entityId: (await prisma.article.findUnique({ where: { url: "https://example.com/articles/harbor-lights" }, select: { id: true } }))?.id ?? "seed-article",
        action: "extracted",
        changedByEmail: "seed@local",
        previousValueJson: { extractionStatus: "New" },
        newValueJson: { extractionStatus: "Needs Review", extractedProjectTitle: "Harbor Lights" },
        reason: "Seed review extraction example.",
        source: "seed"
      },
      {
        entityType: "Project",
        entityId: harborLights?.id ?? "seed-project",
        action: "created",
        changedByEmail: "seed@local",
        previousValueJson: Prisma.JsonNull,
        newValueJson: { title: "Harbor Lights", status: "sold" },
        reason: "Seed starter project.",
        source: "seed"
      },
      {
        entityType: "CurrentShow",
        entityId: southPier?.id ?? "seed-show",
        action: "verified",
        changedByEmail: "seed@local",
        previousValueJson: { verifiedAt: null, needsVerification: true },
        newValueJson: { verifiedAt: date("2026-04-25"), needsVerification: false },
        reason: "Seed verification example.",
        source: "seed"
      }
    ]
  });

  await prisma.savedView.createMany({
    data: [
      {
        name: "Current Development",
        description: "High-priority active development slate.",
        pageType: "development_tracker",
        filtersJson: { savedView: "current", status: "all" },
        sortJson: [{ id: "announcementDate", desc: true }],
        columnsJson: Prisma.JsonNull,
        visibility: "team",
        createdByEmail: "seed@local"
      },
      {
        name: "Needs Review Queue",
        description: "Articles that still need editorial review.",
        pageType: "articles",
        filtersJson: { status: "Needs Review" },
        sortJson: Prisma.JsonNull,
        columnsJson: Prisma.JsonNull,
        visibility: "team",
        createdByEmail: "seed@local"
      }
    ]
  });

  await prisma.teamNote.createMany({
    data: [
      {
        entityType: "Project",
        entityId: harborLights?.id ?? "seed-project",
        note: "Worth flagging for Friday report if Netflix staffing firms up.",
        tags: "weekly-report, buyer-signal",
        includeInNextWeeklyReport: true,
        createdByEmail: "seed@local"
      },
      {
        entityType: "CurrentShow",
        entityId: southPier?.id ?? "seed-show",
        note: "Double-check the finale press date against HBO’s latest calendar.",
        tags: "verification, finale",
        includeInNextWeeklyReport: false,
        createdByEmail: "seed@local"
      }
    ]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
