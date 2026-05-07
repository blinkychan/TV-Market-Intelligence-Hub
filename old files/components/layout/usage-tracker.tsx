"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function UsageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentRef = useRef<string>("");

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (!pathname || sentRef.current === key) return;
    sentRef.current = key;

    void fetch("/api/usage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "page_view",
        page: pathname,
        value: searchParams.toString() || null
      })
    }).catch(() => null);
  }, [pathname, searchParams]);

  return null;
}

