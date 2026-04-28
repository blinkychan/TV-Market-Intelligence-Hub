"use client";

import { Button } from "@/components/ui/button";

export default function BuyerDetailError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border bg-white p-8 text-center shadow-panel">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Buyer Profile</p>
      <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{error.message}</p>
      <Button className="mt-5" type="button" onClick={reset}>Try Again</Button>
    </div>
  );
}
