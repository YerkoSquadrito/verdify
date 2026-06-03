"use client";

import { useState } from "react";
import { Sparkles, BookText, MessageSquareWarning, RotateCcw } from "lucide-react";
import { FAQ, type FaqEntry } from "@/lib/assistant/faq";
import { Button } from "@/components/ui/button";

/**
 * Clickable-FAQ assistant: a fixed set of questions, each with a hand-written,
 * citation-bearing answer. No free-text input and no model — the deterministic
 * stand-in for the RAG-bounded Compliance Assistant. Clicking a question appends
 * it (and its cited answer) to a chat-style transcript.
 */
export function FaqChat() {
  const [asked, setAsked] = useState<FaqEntry[]>([]);

  const remaining = FAQ.filter((f) => !asked.some((a) => a.id === f.id));

  function ask(entry: FaqEntry) {
    setAsked((prev) => [...prev, entry]);
  }

  return (
    <div className="space-y-5">
      {/* Transcript */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        {/* Intro */}
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-muted">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
            Ask me about EBEWE compliance. Pick a question below — every answer
            cites the relevant code section, and anything that depends on your
            specific building defers to your energy consultant.
          </div>
        </div>

        {asked.map((entry) => (
          <div key={entry.id} className="space-y-3">
            {/* User question */}
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {entry.question}
              </div>
            </div>
            {/* Assistant answer */}
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-muted">
                {entry.escalation ? (
                  <MessageSquareWarning className="h-4 w-4 text-status-warn" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="max-w-[80%] space-y-2">
                <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm leading-relaxed">
                  {entry.answer}
                </div>
                <p
                  className={
                    "flex items-center gap-1.5 text-xs " +
                    (entry.escalation
                      ? "font-medium text-status-warn"
                      : "text-muted-foreground")
                  }
                >
                  {entry.escalation ? (
                    <MessageSquareWarning className="h-3 w-3" />
                  ) : (
                    <BookText className="h-3 w-3" />
                  )}
                  {entry.citation}
                </p>
              </div>
            </div>
          </div>
        ))}

        {asked.length > 0 && (
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAsked([])}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          </div>
        )}
      </div>

      {/* Question picker */}
      {remaining.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {asked.length > 0 ? "Ask another" : "Common questions"}
          </p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => ask(entry)}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary-muted hover:text-primary"
              >
                {entry.question}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          That&apos;s every question for now. The production assistant adds
          retrieval over the full ordinance text.
        </p>
      )}
    </div>
  );
}
