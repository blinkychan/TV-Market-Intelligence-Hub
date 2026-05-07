"use client";

export default function BackfillQueueError({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-panel">
      <h2 className="text-lg font-semibold">Backfill queue unavailable</h2>
      <p className="mt-2 text-sm">{error.message || "The backfill queue could not be loaded."}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 inline-flex h-9 items-center rounded-md bg-rose-700 px-4 text-sm font-medium text-white transition hover:bg-rose-800"
      >
        Try again
      </button>
    </div>
  );
}
