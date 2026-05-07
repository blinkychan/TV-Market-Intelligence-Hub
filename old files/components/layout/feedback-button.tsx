"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type FeedbackButtonProps = {
  variant?: "floating" | "inline";
  defaultType?: "bug" | "data_issue" | "feature_request" | "confusion" | "other";
  entityType?: string | null;
  entityId?: string | null;
  label?: string;
};

export function FeedbackButton({
  variant = "floating",
  defaultType = "other",
  entityType = null,
  entityId = null,
  label
}: FeedbackButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState(defaultType);
  const [message, setMessage] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");

  const page = useMemo(() => pathname || "/", [pathname]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        page,
        entityType,
        entityId,
        feedbackType,
        message,
        screenshotUrl: screenshotUrl || null,
        priority
      })
    }).catch(() => null);

    if (!response?.ok) {
      setStatus("error");
      return;
    }

    setStatus("sent");
    setMessage("");
    setScreenshotUrl("");
    setPriority("medium");
  }

  const trigger = (
    <Button
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-label={label ?? "Send feedback"}
      variant={variant === "floating" ? "primary" : "secondary"}
      className={variant === "floating" ? "shadow-panel" : ""}
    >
      <MessageSquarePlus className="h-4 w-4" />
      {label ?? "Send Feedback"}
    </Button>
  );

  return (
    <>
      {variant === "floating" ? (
        <div className="fixed bottom-5 right-5 z-40">{trigger}</div>
      ) : (
        trigger
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/25 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Beta Feedback</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Send feedback</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This is a beta internal tool. Please tell us where the workflow is confusing, wrong, or just annoying.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close feedback form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium">Current page</label>
                <Input value={page} readOnly aria-label="Current page" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Feedback type</label>
                <Select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value as typeof feedbackType)} aria-label="Feedback type">
                  <option value="bug">Bug</option>
                  <option value="data_issue">Data issue</option>
                  <option value="feature_request">Feature request</option>
                  <option value="confusion">Confusion</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <Select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} aria-label="Priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">What should we know?</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  rows={5}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  placeholder="Tell us what happened, what you expected, or what feels confusing."
                  aria-label="Feedback message"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Screenshot URL (optional)</label>
                <Input
                  value={screenshotUrl}
                  onChange={(event) => setScreenshotUrl(event.target.value)}
                  placeholder="Paste an internal screenshot link if helpful"
                  aria-label="Screenshot URL"
                />
              </div>

              {status === "sent" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Thanks — feedback sent.
                </div>
              ) : null}
              {status === "error" ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  We couldn’t submit that just now. Please try again.
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={status === "saving" || message.trim().length < 5}>
                  {status === "saving" ? "Sending..." : "Submit Feedback"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

