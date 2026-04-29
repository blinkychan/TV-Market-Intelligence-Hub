"use client";

import { useRouter } from "next/navigation";
import { SavedViewsPanel } from "@/components/shared/saved-views-panel";
import type { SavedViewRecord } from "@/lib/saved-views";

function toSearchParams(filtersJson: unknown) {
  const params = new URLSearchParams();
  if (!filtersJson || typeof filtersJson !== "object" || Array.isArray(filtersJson)) return params;

  for (const [key, value] of Object.entries(filtersJson as Record<string, unknown>)) {
    if (value == null || value === "" || value === "all") continue;
    params.set(key, String(value));
  }

  return params;
}

export function SavedViewRouterPanel(props: {
  pageType: string;
  savedViews: SavedViewRecord[];
  returnPath: string;
  currentState: { filtersJson: unknown; sortJson?: unknown; columnsJson?: unknown };
  canCreateTeamView: boolean;
  canWrite?: boolean;
  currentUserEmail?: string | null;
  canManageAll?: boolean;
}) {
  const router = useRouter();

  return (
    <SavedViewsPanel
      {...props}
      onLoadView={(view) => {
        const params = toSearchParams(view.filtersJson);
        const target = params.size ? `${props.returnPath}?${params.toString()}` : props.returnPath;
        router.push(target);
      }}
    />
  );
}
