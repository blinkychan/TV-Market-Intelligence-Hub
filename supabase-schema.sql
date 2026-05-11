-- ============================================================
-- TV Market Intelligence Hub — Full Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ENUMS
CREATE TYPE "ProjectType" AS ENUM ('scripted','unscripted','animation','limited_series','format','international','acquisition','co_production');
CREATE TYPE "ProjectStatus" AS ENUM ('sold','in_development','pilot_order','series_order','airing','renewed','canceled','passed','stale','unknown');
CREATE TYPE "BuyerType" AS ENUM ('broadcast','cable','streamer','studio','distributor');
CREATE TYPE "CompanyType" AS ENUM ('studio','production_company','distributor','agency','management_company');
CREATE TYPE "PersonRole" AS ENUM ('writer','creator','showrunner','producer','actor','executive','director');
CREATE TYPE "UserRole" AS ENUM ('admin','editor','viewer');
CREATE TYPE "CurrentShowSeasonType" AS ENUM ('new_series','returning_series','limited_series','special','finale');
CREATE TYPE "DuplicateStatus" AS ENUM ('not_duplicate','possible_duplicate','confirmed_duplicate','merged');
CREATE TYPE "SavedViewVisibility" AS ENUM ('private','team');
CREATE TYPE "ConfidenceLevel" AS ENUM ('high','medium','low');
CREATE TYPE "SourceCoverageType" AS ENUM ('trade','official_press','calendar','manual_csv','search_api','rss');
CREATE TYPE "MissingDataSeverity" AS ENUM ('low','medium','high');
CREATE TYPE "WatchlistType" AS ENUM ('buyer','company','person','genre','keyword','source','status','country');
CREATE TYPE "AutoPopulateMode" AS ENUM ('off','cautious','aggressive');
CREATE TYPE "EmbeddingStatus" AS ENUM ('pending','indexed','stale','failed');
CREATE TYPE "AlertType" AS ENUM ('new_match','status_change','premiere_update','low_confidence','missing_data','duplicate_detected');
CREATE TYPE "JobRunStatus" AS ENUM ('queued','running','completed','failed','canceled');
CREATE TYPE "FeedbackType" AS ENUM ('bug','data_issue','feature_request','confusion','other');
CREATE TYPE "FeedbackStatus" AS ENUM ('new','triaged','in_progress','resolved','dismissed');
CREATE TYPE "FeedbackPriority" AS ENUM ('low','medium','high');
CREATE TYPE "AutomationMode" AS ENUM ('off','cautious','aggressive');

-- TABLES

CREATE TABLE "Buyer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "aliases" TEXT,
  "type" "BuyerType" NOT NULL,
  "parentCompany" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "aliases" TEXT,
  "type" "CompanyType" NOT NULL,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Person" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "aliases" TEXT,
  "role" "PersonRole" NOT NULL,
  "company" TEXT,
  "reps" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "aliases" TEXT,
  "type" "ProjectType" NOT NULL,
  "status" "ProjectStatus" NOT NULL,
  "logline" TEXT,
  "genre" TEXT,
  "format" TEXT,
  "source_material" TEXT,
  "buyerId" TEXT REFERENCES "Buyer"("id") ON DELETE SET NULL,
  "networkOrPlatform" TEXT,
  "studioId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL,
  "countryOfOrigin" TEXT,
  "isInternational" BOOLEAN NOT NULL DEFAULT false,
  "isCoProduction" BOOLEAN NOT NULL DEFAULT false,
  "isAcquisition" BOOLEAN NOT NULL DEFAULT false,
  "acquisitionDetails" TEXT,
  "announcementDate" TIMESTAMP(3),
  "premiereDate" TIMESTAMP(3),
  "lastUpdateDate" TIMESTAMP(3),
  "sourceUrl" TEXT,
  "sourcePublication" TEXT,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'medium',
  "confidenceReasons" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "autoCreated" BOOLEAN NOT NULL DEFAULT false,
  "autoCreatedMode" TEXT,
  "notes" TEXT,
  "searchableText" TEXT,
  "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Many-to-many join tables
CREATE TABLE "_ProjectProductionCompanies" (
  "A" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "B" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  PRIMARY KEY ("A","B")
);
CREATE INDEX "_ProjectProductionCompanies_B_index" ON "_ProjectProductionCompanies"("B");

CREATE TABLE "_ProjectPeople" (
  "A" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "B" TEXT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
  PRIMARY KEY ("A","B")
);
CREATE INDEX "_ProjectPeople_B_index" ON "_ProjectPeople"("B");

CREATE TABLE "CurrentShow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "aliases" TEXT,
  "networkOrPlatform" TEXT NOT NULL,
  "premiereDate" TIMESTAMP(3),
  "finaleDate" TIMESTAMP(3),
  "seasonNumber" INTEGER,
  "episodeCount" INTEGER,
  "status" TEXT NOT NULL,
  "genre" TEXT,
  "studio" TEXT,
  "productionCompanies" TEXT,
  "country" TEXT,
  "sourceType" TEXT,
  "sourceReliability" TEXT,
  "seasonType" "CurrentShowSeasonType",
  "premiereTime" TEXT,
  "episodeTitle" TEXT,
  "episodeNumber" INTEGER,
  "airPattern" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "needsVerification" BOOLEAN NOT NULL DEFAULT false,
  "sourceUrl" TEXT,
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.68,
  "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'medium',
  "confidenceReasons" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "autoCreated" BOOLEAN NOT NULL DEFAULT false,
  "autoCreatedMode" TEXT,
  "notes" TEXT,
  "searchableText" TEXT,
  "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CurrentTvSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "url" TEXT,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sourceReliability" TEXT,
  "lastChecked" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Article" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL UNIQUE,
  "publication" TEXT,
  "headline" TEXT NOT NULL,
  "aliases" TEXT,
  "publishedDate" TIMESTAMP(3),
  "summary" TEXT,
  "rawText" TEXT,
  "rawHtml" TEXT,
  "extractedText" TEXT,
  "extractedExcerpt" TEXT,
  "extractionMethod" TEXT,
  "bodyFetchStatus" TEXT,
  "bodyFetchError" TEXT,
  "bodyFetchedAt" TIMESTAMP(3),
  "robotsAllowed" BOOLEAN,
  "paywallLikely" BOOLEAN NOT NULL DEFAULT false,
  "sourceReliability" TEXT,
  "sourceType" TEXT,
  "ingestionSource" TEXT,
  "needsReview" BOOLEAN NOT NULL DEFAULT true,
  "extractionStatus" TEXT NOT NULL DEFAULT 'Needs Review',
  "extractionMode" TEXT,
  "suspectedCategory" TEXT,
  "linkedProjectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL,
  "linkedShowId" TEXT REFERENCES "CurrentShow"("id") ON DELETE SET NULL,
  "confidenceScore" DOUBLE PRECISION,
  "relevanceScore" DOUBLE PRECISION,
  "relevanceBand" TEXT,
  "relevanceReasons" TEXT,
  "relevanceDecision" TEXT,
  "extractionConfidence" DOUBLE PRECISION,
  "extractionSource" TEXT,
  "bodyAvailable" BOOLEAN NOT NULL DEFAULT false,
  "extractedProjectTitle" TEXT,
  "extractedFormat" TEXT,
  "extractedGenre" TEXT,
  "extractedSourceMaterial" TEXT,
  "extractedStatus" TEXT,
  "extractedLogline" TEXT,
  "extractedBuyer" TEXT,
  "extractedStudio" TEXT,
  "extractedCompanies" TEXT,
  "extractedPeople" TEXT,
  "extractedCountry" TEXT,
  "extractedIsAcquisition" BOOLEAN,
  "extractedIsCoProduction" BOOLEAN,
  "extractedIsInternational" BOOLEAN,
  "extractedPremiereDate" TIMESTAMP(3),
  "extractedAnnouncementDate" TIMESTAMP(3),
  "extractedRelationships" TEXT,
  "extractedFieldsNeedingReview" TEXT,
  "extractedDeduplicationNotes" TEXT,
  "extractedStructuredDataJson" JSONB,
  "aiExtractionError" TEXT,
  "duplicateGroupId" TEXT,
  "duplicateConfidence" DOUBLE PRECISION,
  "possibleDuplicateOfId" TEXT,
  "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'not_duplicate',
  "tags" TEXT,
  "archivedAt" TIMESTAMP(3),
  "searchableText" TEXT,
  "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'pending',
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "RssFeed" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicationName" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastChecked" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "IngestionRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceType" TEXT NOT NULL,
  "sourceName" TEXT,
  "status" TEXT NOT NULL,
  "itemsFetched" INTEGER NOT NULL DEFAULT 0,
  "itemsSaved" INTEGER NOT NULL DEFAULT 0,
  "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT
);

CREATE TABLE "SourceCoverage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceName" TEXT NOT NULL,
  "sourceType" "SourceCoverageType" NOT NULL,
  "baseUrl" TEXT,
  "rssUrlsJson" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "reliabilityScore" DOUBLE PRECISION,
  "allowedCategories" TEXT,
  "blockedKeywords" TEXT,
  "preferredKeywords" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "lastSuccessfulFetchAt" TIMESTAMP(3),
  "articlesFetchedLastRun" INTEGER NOT NULL DEFAULT 0,
  "articlesSavedLastRun" INTEGER NOT NULL DEFAULT 0,
  "articlesExcludedLastRun" INTEGER NOT NULL DEFAULT 0,
  "highRelevanceCountLastRun" INTEGER NOT NULL DEFAULT 0,
  "mediumRelevanceCountLastRun" INTEGER NOT NULL DEFAULT 0,
  "lowRelevanceCountLastRun" INTEGER NOT NULL DEFAULT 0,
  "commonExclusionReasons" TEXT,
  "failuresLast7Days" INTEGER NOT NULL DEFAULT 0,
  "sourceReliability" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE("sourceName","sourceType")
);

CREATE TABLE "MissingDataFlag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "missingField" TEXT NOT NULL,
  "severity" "MissingDataSeverity" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changedByUserId" TEXT,
  "changedByEmail" TEXT,
  "previousValueJson" JSONB,
  "newValueJson" JSONB,
  "reason" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SavedView" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pageType" TEXT NOT NULL,
  "filtersJson" JSONB,
  "sortJson" JSONB,
  "columnsJson" JSONB,
  "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'private',
  "createdByUserId" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "TeamNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "tags" TEXT,
  "includeInNextWeeklyReport" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Watchlist" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "watchType" "WatchlistType" NOT NULL,
  "criteriaJson" JSONB,
  "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'private',
  "createdByUserId" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Alert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "watchlistId" TEXT REFERENCES "Watchlist"("id") ON DELETE SET NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "alertType" "AlertType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" "MissingDataSeverity" NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "BackfillJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "keywords" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "articlesFound" INTEGER NOT NULL DEFAULT 0,
  "articlesSaved" INTEGER NOT NULL DEFAULT 0,
  "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3)
);

CREATE TABLE "Relationship" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "buyerId" TEXT REFERENCES "Buyer"("id") ON DELETE SET NULL,
  "companyId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL,
  "personId" TEXT REFERENCES "Person"("id") ON DELETE SET NULL,
  "projectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL,
  "relationshipType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "date" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WeeklyReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "generatedMarkdown" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "role" "UserRole" NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "EmailPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "receiveWeeklyReport" BOOLEAN NOT NULL DEFAULT false,
  "receiveHighSeverityAlerts" BOOLEAN NOT NULL DEFAULT false,
  "receiveWatchlistAlerts" BOOLEAN NOT NULL DEFAULT false,
  "weeklyReportDay" TEXT NOT NULL DEFAULT 'friday',
  "weeklyReportTime" TEXT NOT NULL DEFAULT '09:00',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "JobRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobType" TEXT NOT NULL,
  "status" "JobRunStatus" NOT NULL DEFAULT 'queued',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdByEmail" TEXT,
  "inputJson" JSONB,
  "resultJson" JSONB,
  "errorMessage" TEXT,
  "lockKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "email" TEXT,
  "page" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "feedbackType" "FeedbackType" NOT NULL,
  "message" TEXT NOT NULL,
  "screenshotUrl" TEXT,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
  "priority" "FeedbackPriority" NOT NULL DEFAULT 'medium',
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "email" TEXT,
  "eventType" TEXT NOT NULL,
  "page" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "key" TEXT,
  "value" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AutoPopulationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "articleId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "confidenceScore" DOUBLE PRECISION,
  "mode" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DigDeeperRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "query" TEXT,
  "findingsText" TEXT,
  "findingsJson" JSONB,
  "approvedAt" TIMESTAMP(3),
  "approvedByEmail" TEXT,
  "appliedAt" TIMESTAMP(3),
  "appliedByEmail" TEXT,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "SearchLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "query" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT,
  "email" TEXT,
  "filters" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AutomationSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rssEnabled" BOOLEAN NOT NULL DEFAULT true,
  "backfillEnabled" BOOLEAN NOT NULL DEFAULT true,
  "bodyExtractionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "aiExtractionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "autoCreateDraftRecordsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maxArticlesPerRun" INTEGER NOT NULL DEFAULT 10,
  "maxBodyFetchesPerRun" INTEGER NOT NULL DEFAULT 5,
  "maxAIExtractionsPerRun" INTEGER NOT NULL DEFAULT 3,
  "maxBackfillJobsPerRun" INTEGER NOT NULL DEFAULT 1,
  "automationMode" "AutomationMode" NOT NULL DEFAULT 'cautious',
  "isPaused" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "triggeredBy" TEXT NOT NULL DEFAULT 'cron',
  "steps" TEXT NOT NULL DEFAULT 'all',
  "mode" TEXT NOT NULL,
  "isPaused" BOOLEAN NOT NULL DEFAULT false,
  "rssArticlesFetched" INTEGER NOT NULL DEFAULT 0,
  "rssArticlesSaved" INTEGER NOT NULL DEFAULT 0,
  "backfillJobsRun" INTEGER NOT NULL DEFAULT 0,
  "backfillArticles" INTEGER NOT NULL DEFAULT 0,
  "bodiesFetched" INTEGER NOT NULL DEFAULT 0,
  "bodiesSkipped" INTEGER NOT NULL DEFAULT 0,
  "aiExtractionsRun" INTEGER NOT NULL DEFAULT 0,
  "draftsCreated" INTEGER NOT NULL DEFAULT 0,
  "deduplicatesFound" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "errorMessages" TEXT,
  "durationMs" INTEGER,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SavedSearch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "searchMode" TEXT NOT NULL DEFAULT 'fuzzy',
  "genre" TEXT,
  "buyer" TEXT,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  "includeShows" BOOLEAN NOT NULL DEFAULT true,
  "includeProjects" BOOLEAN NOT NULL DEFAULT true,
  "includeStale" BOOLEAN NOT NULL DEFAULT false,
  "includeArticles" BOOLEAN NOT NULL DEFAULT true,
  "email" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- INDEXES

CREATE INDEX "Buyer_type_idx" ON "Buyer"("type");
CREATE INDEX "Buyer_parentCompany_idx" ON "Buyer"("parentCompany");
CREATE INDEX "Buyer_duplicateGroupId_idx" ON "Buyer"("duplicateGroupId");
CREATE INDEX "Buyer_duplicateStatus_idx" ON "Buyer"("duplicateStatus");
CREATE INDEX "Buyer_archivedAt_idx" ON "Buyer"("archivedAt");

CREATE INDEX "Company_type_idx" ON "Company"("type");
CREATE INDEX "Company_duplicateGroupId_idx" ON "Company"("duplicateGroupId");
CREATE INDEX "Company_duplicateStatus_idx" ON "Company"("duplicateStatus");
CREATE INDEX "Company_archivedAt_idx" ON "Company"("archivedAt");

CREATE INDEX "Person_role_idx" ON "Person"("role");
CREATE INDEX "Person_company_idx" ON "Person"("company");
CREATE INDEX "Person_duplicateGroupId_idx" ON "Person"("duplicateGroupId");
CREATE INDEX "Person_duplicateStatus_idx" ON "Person"("duplicateStatus");
CREATE INDEX "Person_archivedAt_idx" ON "Person"("archivedAt");

CREATE INDEX "Project_title_idx" ON "Project"("title");
CREATE INDEX "Project_buyerId_idx" ON "Project"("buyerId");
CREATE INDEX "Project_studioId_idx" ON "Project"("studioId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_genre_idx" ON "Project"("genre");
CREATE INDEX "Project_countryOfOrigin_idx" ON "Project"("countryOfOrigin");
CREATE INDEX "Project_announcementDate_idx" ON "Project"("announcementDate");
CREATE INDEX "Project_premiereDate_idx" ON "Project"("premiereDate");
CREATE INDEX "Project_confidenceLevel_idx" ON "Project"("confidenceLevel");
CREATE INDEX "Project_duplicateGroupId_idx" ON "Project"("duplicateGroupId");
CREATE INDEX "Project_duplicateStatus_idx" ON "Project"("duplicateStatus");
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");
CREATE INDEX "Project_autoCreated_idx" ON "Project"("autoCreated");
CREATE INDEX "Project_embeddingStatus_idx" ON "Project"("embeddingStatus");
CREATE INDEX "Project_lastIndexedAt_idx" ON "Project"("lastIndexedAt");

CREATE INDEX "CurrentShow_premiereDate_idx" ON "CurrentShow"("premiereDate");
CREATE INDEX "CurrentShow_finaleDate_idx" ON "CurrentShow"("finaleDate");
CREATE INDEX "CurrentShow_networkOrPlatform_idx" ON "CurrentShow"("networkOrPlatform");
CREATE INDEX "CurrentShow_status_idx" ON "CurrentShow"("status");
CREATE INDEX "CurrentShow_genre_idx" ON "CurrentShow"("genre");
CREATE INDEX "CurrentShow_seasonType_idx" ON "CurrentShow"("seasonType");
CREATE INDEX "CurrentShow_needsVerification_idx" ON "CurrentShow"("needsVerification");
CREATE INDEX "CurrentShow_verifiedAt_idx" ON "CurrentShow"("verifiedAt");
CREATE INDEX "CurrentShow_confidenceLevel_idx" ON "CurrentShow"("confidenceLevel");
CREATE INDEX "CurrentShow_duplicateGroupId_idx" ON "CurrentShow"("duplicateGroupId");
CREATE INDEX "CurrentShow_duplicateStatus_idx" ON "CurrentShow"("duplicateStatus");
CREATE INDEX "CurrentShow_archivedAt_idx" ON "CurrentShow"("archivedAt");
CREATE INDEX "CurrentShow_autoCreated_idx" ON "CurrentShow"("autoCreated");
CREATE INDEX "CurrentShow_embeddingStatus_idx" ON "CurrentShow"("embeddingStatus");
CREATE INDEX "CurrentShow_lastIndexedAt_idx" ON "CurrentShow"("lastIndexedAt");

CREATE INDEX "CurrentTvSource_name_idx" ON "CurrentTvSource"("name");
CREATE INDEX "CurrentTvSource_sourceType_idx" ON "CurrentTvSource"("sourceType");
CREATE INDEX "CurrentTvSource_category_idx" ON "CurrentTvSource"("category");
CREATE INDEX "CurrentTvSource_enabled_idx" ON "CurrentTvSource"("enabled");

CREATE INDEX "Article_publication_idx" ON "Article"("publication");
CREATE INDEX "Article_publishedDate_idx" ON "Article"("publishedDate");
CREATE INDEX "Article_needsReview_idx" ON "Article"("needsReview");
CREATE INDEX "Article_ingestionSource_idx" ON "Article"("ingestionSource");
CREATE INDEX "Article_bodyFetchStatus_idx" ON "Article"("bodyFetchStatus");
CREATE INDEX "Article_sourceReliability_idx" ON "Article"("sourceReliability");
CREATE INDEX "Article_extractionSource_idx" ON "Article"("extractionSource");
CREATE INDEX "Article_relevanceBand_idx" ON "Article"("relevanceBand");
CREATE INDEX "Article_relevanceDecision_idx" ON "Article"("relevanceDecision");
CREATE INDEX "Article_extractionStatus_idx" ON "Article"("extractionStatus");
CREATE INDEX "Article_extractionMode_idx" ON "Article"("extractionMode");
CREATE INDEX "Article_suspectedCategory_idx" ON "Article"("suspectedCategory");
CREATE INDEX "Article_linkedProjectId_idx" ON "Article"("linkedProjectId");
CREATE INDEX "Article_linkedShowId_idx" ON "Article"("linkedShowId");
CREATE INDEX "Article_duplicateGroupId_idx" ON "Article"("duplicateGroupId");
CREATE INDEX "Article_duplicateStatus_idx" ON "Article"("duplicateStatus");
CREATE INDEX "Article_archivedAt_idx" ON "Article"("archivedAt");
CREATE INDEX "Article_embeddingStatus_idx" ON "Article"("embeddingStatus");
CREATE INDEX "Article_lastIndexedAt_idx" ON "Article"("lastIndexedAt");

CREATE INDEX "RssFeed_publicationName_idx" ON "RssFeed"("publicationName");
CREATE INDEX "RssFeed_category_idx" ON "RssFeed"("category");
CREATE INDEX "RssFeed_enabled_idx" ON "RssFeed"("enabled");
CREATE INDEX "RssFeed_lastChecked_idx" ON "RssFeed"("lastChecked");

CREATE INDEX "IngestionRun_sourceType_idx" ON "IngestionRun"("sourceType");
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
CREATE INDEX "IngestionRun_completedAt_idx" ON "IngestionRun"("completedAt");

CREATE INDEX "SourceCoverage_sourceType_idx" ON "SourceCoverage"("sourceType");
CREATE INDEX "SourceCoverage_enabled_idx" ON "SourceCoverage"("enabled");
CREATE INDEX "SourceCoverage_lastCheckedAt_idx" ON "SourceCoverage"("lastCheckedAt");
CREATE INDEX "SourceCoverage_lastSuccessfulFetchAt_idx" ON "SourceCoverage"("lastSuccessfulFetchAt");

CREATE INDEX "MissingDataFlag_entityType_idx" ON "MissingDataFlag"("entityType");
CREATE INDEX "MissingDataFlag_entityId_idx" ON "MissingDataFlag"("entityId");
CREATE INDEX "MissingDataFlag_missingField_idx" ON "MissingDataFlag"("missingField");
CREATE INDEX "MissingDataFlag_severity_idx" ON "MissingDataFlag"("severity");
CREATE INDEX "MissingDataFlag_resolvedAt_idx" ON "MissingDataFlag"("resolvedAt");

CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_changedByUserId_idx" ON "AuditLog"("changedByUserId");
CREATE INDEX "AuditLog_changedByEmail_idx" ON "AuditLog"("changedByEmail");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX "SavedView_pageType_idx" ON "SavedView"("pageType");
CREATE INDEX "SavedView_visibility_idx" ON "SavedView"("visibility");
CREATE INDEX "SavedView_createdByUserId_idx" ON "SavedView"("createdByUserId");
CREATE INDEX "SavedView_createdByEmail_idx" ON "SavedView"("createdByEmail");
CREATE INDEX "SavedView_createdAt_idx" ON "SavedView"("createdAt");

CREATE INDEX "TeamNote_entityType_idx" ON "TeamNote"("entityType");
CREATE INDEX "TeamNote_entityId_idx" ON "TeamNote"("entityId");
CREATE INDEX "TeamNote_includeInNextWeeklyReport_idx" ON "TeamNote"("includeInNextWeeklyReport");
CREATE INDEX "TeamNote_createdByUserId_idx" ON "TeamNote"("createdByUserId");
CREATE INDEX "TeamNote_createdByEmail_idx" ON "TeamNote"("createdByEmail");
CREATE INDEX "TeamNote_createdAt_idx" ON "TeamNote"("createdAt");

CREATE INDEX "Watchlist_watchType_idx" ON "Watchlist"("watchType");
CREATE INDEX "Watchlist_visibility_idx" ON "Watchlist"("visibility");
CREATE INDEX "Watchlist_createdByUserId_idx" ON "Watchlist"("createdByUserId");
CREATE INDEX "Watchlist_createdByEmail_idx" ON "Watchlist"("createdByEmail");
CREATE INDEX "Watchlist_createdAt_idx" ON "Watchlist"("createdAt");

CREATE INDEX "Alert_watchlistId_idx" ON "Alert"("watchlistId");
CREATE INDEX "Alert_entityType_idx" ON "Alert"("entityType");
CREATE INDEX "Alert_entityId_idx" ON "Alert"("entityId");
CREATE INDEX "Alert_alertType_idx" ON "Alert"("alertType");
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

CREATE INDEX "BackfillJob_source_idx" ON "BackfillJob"("source");
CREATE INDEX "BackfillJob_year_month_idx" ON "BackfillJob"("year","month");
CREATE INDEX "BackfillJob_status_idx" ON "BackfillJob"("status");
CREATE INDEX "BackfillJob_createdAt_idx" ON "BackfillJob"("createdAt");
CREATE INDEX "BackfillJob_completedAt_idx" ON "BackfillJob"("completedAt");

CREATE INDEX "Relationship_relationshipType_idx" ON "Relationship"("relationshipType");
CREATE INDEX "Relationship_date_idx" ON "Relationship"("date");
CREATE INDEX "Relationship_buyerId_idx" ON "Relationship"("buyerId");
CREATE INDEX "Relationship_companyId_idx" ON "Relationship"("companyId");
CREATE INDEX "Relationship_personId_idx" ON "Relationship"("personId");
CREATE INDEX "Relationship_projectId_idx" ON "Relationship"("projectId");

CREATE INDEX "WeeklyReport_weekStart_idx" ON "WeeklyReport"("weekStart");
CREATE INDEX "WeeklyReport_generatedAt_idx" ON "WeeklyReport"("generatedAt");

CREATE INDEX "UserProfile_role_idx" ON "UserProfile"("role");

CREATE INDEX "EmailPreference_userId_idx" ON "EmailPreference"("userId");
CREATE INDEX "EmailPreference_email_idx" ON "EmailPreference"("email");
CREATE INDEX "EmailPreference_receiveWeeklyReport_idx" ON "EmailPreference"("receiveWeeklyReport");
CREATE INDEX "EmailPreference_receiveHighSeverityAlerts_idx" ON "EmailPreference"("receiveHighSeverityAlerts");
CREATE INDEX "EmailPreference_receiveWatchlistAlerts_idx" ON "EmailPreference"("receiveWatchlistAlerts");

CREATE INDEX "JobRun_jobType_idx" ON "JobRun"("jobType");
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");
CREATE INDEX "JobRun_lockKey_idx" ON "JobRun"("lockKey");
CREATE INDEX "JobRun_createdByUserId_idx" ON "JobRun"("createdByUserId");
CREATE INDEX "JobRun_createdByEmail_idx" ON "JobRun"("createdByEmail");
CREATE INDEX "JobRun_createdAt_idx" ON "JobRun"("createdAt");

CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Feedback_email_idx" ON "Feedback"("email");
CREATE INDEX "Feedback_page_idx" ON "Feedback"("page");
CREATE INDEX "Feedback_entityType_entityId_idx" ON "Feedback"("entityType","entityId");
CREATE INDEX "Feedback_feedbackType_idx" ON "Feedback"("feedbackType");
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");
CREATE INDEX "Feedback_priority_idx" ON "Feedback"("priority");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent"("userId");
CREATE INDEX "UsageEvent_email_idx" ON "UsageEvent"("email");
CREATE INDEX "UsageEvent_eventType_idx" ON "UsageEvent"("eventType");
CREATE INDEX "UsageEvent_page_idx" ON "UsageEvent"("page");
CREATE INDEX "UsageEvent_entityType_entityId_idx" ON "UsageEvent"("entityType","entityId");
CREATE INDEX "UsageEvent_key_idx" ON "UsageEvent"("key");
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

CREATE INDEX "AppSettings_key_idx" ON "AppSettings"("key");

CREATE INDEX "AutoPopulationLog_articleId_idx" ON "AutoPopulationLog"("articleId");
CREATE INDEX "AutoPopulationLog_entityType_idx" ON "AutoPopulationLog"("entityType");
CREATE INDEX "AutoPopulationLog_entityId_idx" ON "AutoPopulationLog"("entityId");
CREATE INDEX "AutoPopulationLog_action_idx" ON "AutoPopulationLog"("action");
CREATE INDEX "AutoPopulationLog_mode_idx" ON "AutoPopulationLog"("mode");
CREATE INDEX "AutoPopulationLog_createdAt_idx" ON "AutoPopulationLog"("createdAt");

CREATE INDEX "DigDeeperRun_entityType_entityId_idx" ON "DigDeeperRun"("entityType","entityId");
CREATE INDEX "DigDeeperRun_status_idx" ON "DigDeeperRun"("status");
CREATE INDEX "DigDeeperRun_createdAt_idx" ON "DigDeeperRun"("createdAt");

CREATE INDEX "SearchLog_query_idx" ON "SearchLog"("query");
CREATE INDEX "SearchLog_email_idx" ON "SearchLog"("email");
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

CREATE INDEX "AutomationRun_triggeredBy_idx" ON "AutomationRun"("triggeredBy");
CREATE INDEX "AutomationRun_createdAt_idx" ON "AutomationRun"("createdAt");
CREATE INDEX "AutomationRun_completedAt_idx" ON "AutomationRun"("completedAt");

CREATE INDEX "SavedSearch_email_idx" ON "SavedSearch"("email");
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");
CREATE INDEX "SavedSearch_createdAt_idx" ON "SavedSearch"("createdAt");

-- Also needed by Prisma to track applied migrations
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
