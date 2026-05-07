# Team Launch Guide

This guide is the handoff layer for sharing the hosted app with the team.

## Invite teammates

1. In Supabase, open `Authentication` -> `Users`.
2. Create each teammate with email and password access enabled.
3. Ask them to sign in once at `/login`.
4. Open `/admin/status` and add each approved teammate to the Team Roles panel.

## Set roles

- `admin`
  - full access
  - ingestion and backfill controls
  - user and role management
  - operational pages
- `editor`
  - can review articles
  - can create and edit projects, shows, reports, notes, and views
  - cannot manage users
- `viewer`
  - read-only tracking access
  - can export reports and data views
  - cannot run ingestion, extraction, imports, or destructive actions

## What features are live

- Executive dashboard and trend insights
- Development Tracker
- Current TV Tracker and premiere calendar
- Buyers, companies, talent, and relationship views
- Weekly reports
- Review queue
- RSS ingestion
- Historical backfill queue
- Article body extraction when allowed
- AI extraction with human review
- Duplicate review tools
- Audit history
- Saved views
- Team notes
- Watchlists and in-app alerts
- Email preferences and scheduled report delivery
- Import, export, and bulk editing
- Admin status, jobs, launch checklist, and source coverage tools

## What is still experimental

- Real AI extraction quality on ambiguous headlines
- Historical backfill precision on noisier entertainment sources
- Source-specific tuning for lower-signal feeds
- Email digest cadence beyond the weekly/default flows
- Any workflow still marked preview, mock, or possible match

## How to report bad data

1. Open the affected record.
2. Add a Team Note describing the issue and tag it clearly.
3. If the issue affects extracted article data, leave the article in review or move it back into review.
4. If the issue looks systemic, check:
   - `/sources/coverage`
   - `/sources/missing-data`
   - `/duplicates`
   - `/admin/audit-log`

## How to review articles

1. Open `/review`.
2. Start with low-confidence and high-impact items first.
3. Fetch article body text when allowed.
4. Run extraction if needed.
5. Edit extracted fields before approval.
6. Approve only when the buyer, studio, title, and status are trustworthy.
7. Use duplicate warnings and merge tools before creating new records.

## How to generate weekly reports

1. Open `/weekly-reports`.
2. Choose the Friday week-ending date.
3. Review the preview.
4. Confirm the executive summary looks clean.
5. Download Markdown or PDF if needed.
6. Save the report if it should remain in the archive.

If scheduled delivery is enabled, Friday reports can also be sent automatically through the email settings and cron flow.

## Known limitations

- Low-confidence records still require human judgment.
- Headline-only extraction should not be treated as final.
- Body extraction respects robots.txt and does not bypass paywalls.
- Some sources may classify relevant items as possible matches until tuning improves.
- Cron behavior on Vercel Hobby may be more limited than production tiers.
- The temporary `ADMIN_PASSWORD` fallback should not be the long-term protection model.

