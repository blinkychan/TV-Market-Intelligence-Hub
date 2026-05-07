import type { AutoPopulationRunSummary, AutoPopulationArticleResult } from "@/lib/autonomous-population";
import type { DigDeeperResult, DigDeeperEntityType } from "@/lib/dig-deeper";

// ─── Mock auto-population run ─────────────────────────────────────────────────

const MOCK_ARTICLES: AutoPopulationArticleResult[] = [
  {
    articleId: "mock-ap-1",
    headline: "Netflix Sets 'Harbor Lights' Crime Drama From A24, wiip",
    action: "auto_created_project",
    entityId: "mock-auto-project-1",
    entityType: "Project",
    confidenceScore: 0.87,
    reason: "Auto-created draft Project with 87% confidence",
  },
  {
    articleId: "mock-ap-2",
    headline: "BBC and Universal Set 'Northern Exchange' Co-Production",
    action: "auto_created_project",
    entityId: "mock-auto-project-2",
    entityType: "Project",
    confidenceScore: 0.82,
    reason: "Auto-created draft Project with 82% confidence",
  },
  {
    articleId: "mock-ap-3",
    headline: "Peacock Orders Postal Service Drama Pilot",
    action: "auto_created_project",
    entityId: "mock-auto-project-3",
    entityType: "Project",
    confidenceScore: 0.84,
    reason: "Auto-created draft Project with 84% confidence",
  },
  {
    articleId: "mock-ap-4",
    headline: "FX Developing True Crime Limited Series About Telecom Fraud",
    action: "flagged_review",
    confidenceScore: 0.61,
    reason: "Confidence 61% is below the 80% threshold",
  },
  {
    articleId: "mock-ap-5",
    headline: "Amazon Acquires Rights to Bestselling Thriller",
    action: "flagged_review",
    confidenceScore: 0.58,
    reason: "Confidence 58% is below the 80% threshold",
  },
  {
    articleId: "mock-ap-6",
    headline: "Industry Roundup: Networks Plan Fall Slate",
    action: "skipped_low_confidence",
    confidenceScore: 0.24,
    reason: "Headline-only extraction, confidence too low",
  },
  {
    articleId: "mock-ap-7",
    headline: "Signal House Season 2 Confirmed at HBO",
    action: "auto_created_show",
    entityId: "mock-auto-show-1",
    entityType: "CurrentShow",
    confidenceScore: 0.91,
    reason: "Auto-created draft CurrentShow with 91% confidence",
  },
];

export function mockAutoPopulationResult(): AutoPopulationRunSummary {
  const startedAt = new Date(Date.now() - 4800);
  const completedAt = new Date();

  return {
    mode: "cautious",
    dataSource: "mock",
    articlesProcessed: MOCK_ARTICLES.length,
    projectsCreated: MOCK_ARTICLES.filter((a) => a.action === "auto_created_project").length,
    showsCreated: MOCK_ARTICLES.filter((a) => a.action === "auto_created_show").length,
    flaggedForReview: MOCK_ARTICLES.filter((a) => a.action === "flagged_review").length,
    skipped: MOCK_ARTICLES.filter((a) => a.action.startsWith("skipped")).length,
    errors: 0,
    results: MOCK_ARTICLES,
    startedAt,
    completedAt,
    message: `Processed ${MOCK_ARTICLES.length} articles: 3 projects created, 1 show created, 2 flagged for review, 1 skipped.`,
  };
}

// ─── Mock Dig Deeper results ──────────────────────────────────────────────────

const MOCK_PROJECT_FINDINGS = {
  "mock-project-harbor-lights": {
    title: "Harbor Lights",
    findings: [
      {
        type: "development_update" as const,
        title: "AI Summary of Related Coverage",
        description:
          "Recent coverage suggests Harbor Lights is progressing well at Netflix. The A24/wiip package has drawn strong interest; insiders indicate a pilot commitment may be imminent. Lead writer Mia Farrow is attached.",
        confidence: 0.72,
      },
      {
        type: "status_change" as const,
        title: "Possible status change detected: in_development → pilot_order",
        description:
          'Newer article headline suggests: "Netflix Gives Pilot Order to \'Harbor Lights\' Crime Thriller From A24".',
        confidence: 0.68,
        suggestedFieldUpdates: { status: "pilot_order" },
      },
      {
        type: "related_article" as const,
        title: "Netflix Gives Pilot Order to 'Harbor Lights' Crime Thriller From A24",
        description: "Deadline · April 28, 2026",
        sourceUrl: "https://deadline.com/harbor-lights-pilot",
        confidence: 0.85,
      },
      {
        type: "similar_project" as const,
        title: "Similar project: Coastal Crimes",
        description: "Status: in_development, Genre: crime drama, Confidence: 74%",
        confidence: 0.65,
      },
      {
        type: "similar_project" as const,
        title: "Similar project: Port Authority",
        description: "Status: pilot_order, Genre: procedural drama, Confidence: 68%",
        confidence: 0.60,
      },
    ],
    summary:
      "Found 5 findings for \"Harbor Lights\". Possible status change detected. 2 similar project(s) identified.",
  },
};

const DEFAULT_PROJECT_FINDINGS = [
  {
    type: "development_update" as const,
    title: "AI Summary of Related Coverage",
    description:
      "Related articles suggest this project remains in active development. No major status changes detected in recent coverage, though buyer interest appears steady.",
    confidence: 0.65,
  },
  {
    type: "related_article" as const,
    title: "Studio Sources Confirm Project Still in Development",
    description: "Variety · April 22, 2026",
    sourceUrl: "https://variety.com/mock-article",
    confidence: 0.72,
  },
  {
    type: "similar_project" as const,
    title: "Similar project: The Syndicate",
    description: "Status: in_development, Genre: drama, Confidence: 71%",
    confidence: 0.60,
  },
];

export function mockDigDeeperResult(
  entityType: DigDeeperEntityType,
  entityId: string
): DigDeeperResult {
  const projectData =
    entityId in MOCK_PROJECT_FINDINGS
      ? MOCK_PROJECT_FINDINGS[entityId as keyof typeof MOCK_PROJECT_FINDINGS]
      : null;

  const entityTitle =
    entityType === "Project"
      ? projectData?.title ?? "Unknown Project"
      : entityType === "CurrentShow"
        ? "Signal House"
        : "Article";

  const findings =
    projectData?.findings ??
    (entityType === "Project"
      ? DEFAULT_PROJECT_FINDINGS
      : entityType === "CurrentShow"
        ? [
            {
              type: "related_article" as const,
              title: "Signal House Season 2 Premiere Date Confirmed",
              description: "TV Line · April 30, 2026",
              sourceUrl: "https://tvline.com/mock",
              confidence: 0.80,
            },
            {
              type: "development_update" as const,
              title: "Season 3 Renewal Expected",
              description:
                "Multiple trade sources indicate Signal House Season 3 is expected to be renewed given strong viewership numbers.",
              confidence: 0.64,
            },
          ]
        : [
            {
              type: "related_article" as const,
              title: "Follow-up Coverage Found",
              description: "A newer article discusses this project's progress.",
              sourceUrl: null,
              confidence: 0.60,
            },
          ]);

  const summary =
    projectData?.summary ??
    `Found ${findings.length} finding${findings.length === 1 ? "" : "s"} for "${entityTitle}".`;

  return {
    runId: `mock-dig-deeper-${Date.now()}`,
    entityType,
    entityId,
    entityTitle,
    status: "completed",
    findings,
    summary,
    dataSource: "mock",
    requiresApproval: findings.some((f) => "suggestedFieldUpdates" in f && f.suggestedFieldUpdates),
    createdAt: new Date(),
  };
}
