"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Upload,
  Download,
  FileText,
  FilePlus2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  uploadDocumentAction,
  submitComplianceDocAction,
  getSignedUrlAction,
  generateLenderPacketAction,
} from "@/app/(app)/buildings/[buildingId]/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { DocumentRow, DocumentType } from "@/lib/db/types";

const DOC_LABEL: Record<DocumentType, string> = {
  benchmark_submission: "Benchmarking submission",
  arcx_report: "A/RCx report",
  lender_packet: "Lender packet",
  other: "Other",
};

// The three upload choices. Benchmarking and A/RCx route through the compliance
// (cure) action — they record the matching compliance event that clears an open
// violation. "Other" is a vault-only store with no compliance effect.
type UploadKind = "benchmark_submission" | "arcx_report" | "other";

const CURES: Record<UploadKind, boolean> = {
  benchmark_submission: true,
  arcx_report: true,
  other: false,
};

// A cure submission already clears the violation server-side the instant the
// action returns. We hold a short "processing" pass in front of that reveal so
// curing reads as a deliberate review, not an instant flip. The delay lives
// INSIDE the upload transition, so the page's revalidated (now-compliant) tree
// only commits once this finishes — the banner never flips ahead of the steps.
const PROCESSING_STEPS = [
  "Recording submission to the vault…",
  "Validating against EBEWE records…",
  "Updating compliance status…",
];
const PROCESSING_MS = 2200;

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function VaultSection({
  buildingId,
  documents,
  violationOpen = false,
}: {
  buildingId: string;
  documents: DocumentRow[];
  /** True while the building has an unresolved violation — surfaces the cure prompt. */
  violationOpen?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<UploadKind>("benchmark_submission");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [packetBusy, startPacket] = useTransition();
  // True from the moment a cure upload's animation begins until it resolves.
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Advance the processing messages while the cure pass runs.
  useEffect(() => {
    if (!processing) {
      setStepIdx(0);
      return;
    }
    const id = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1)),
      PROCESSING_MS / PROCESSING_STEPS.length,
    );
    return () => clearInterval(id);
  }, [processing]);

  function upload() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const fd = new FormData();
    fd.set("buildingId", buildingId);
    fd.set("file", file);
    const isCure = CURES[kind];
    start(async () => {
      // Benchmarking / A/RCx cure the violation (record the compliance event);
      // "Other" is a plain vault store. Same storage path either way.
      const res = isCure
        ? await submitComplianceDocAction(
            withField(fd, "deadlineType", kind === "benchmark_submission" ? "benchmark" : "arcx"),
          )
        : await uploadDocumentAction(withField(fd, "docType", "other"));
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      // Hold the cleared-violation reveal behind a short processing animation.
      // Still inside the transition, so the refreshed tree commits only after.
      if (isCure) {
        setProcessing(true);
        await sleep(PROCESSING_MS);
        setProcessing(false);
      }
    });
  }

  async function download(path: string) {
    const res = await getSignedUrlAction(path);
    if ("url" in res && res.url) window.open(res.url, "_blank");
    else setError(res.error ?? "Download failed");
  }

  function generatePacket() {
    setError(null);
    startPacket(async () => {
      const res = await generateLenderPacketAction(buildingId);
      if (res?.error) setError(res.error);
    });
  }

  const cures = CURES[kind];

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        {processing ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Processing submission…
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PROCESSING_STEPS[stepIdx]}
              </p>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {PROCESSING_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i <= stepIdx ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
        {violationOpen && (
          <div className="flex items-start gap-2 rounded-md border border-status-warn/40 bg-status-warn/10 p-3 text-xs">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-status-warn" />
            <p className="text-foreground">
              <span className="font-medium">Unresolved violation.</span> Submit the
              required benchmarking or A/RCx document below to cure it — paying the
              fine alone does not.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Document type
            </label>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
            >
              <option value="benchmark_submission">Benchmarking submission</option>
              <option value="arcx_report">A/RCx report</option>
              <option value="other">Other / supporting document</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">File</label>
            {/* Native file input is browser-locale-labelled ("Seleccionar archivo"
                on a Spanish browser); hide it and drive it from a custom English button. */}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                Choose file
              </Button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  fileName ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {fileName ?? "No file selected"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={upload}
              disabled={busy}
            >
              <Upload className="h-4 w-4" />
              {busy ? "Uploading…" : "Upload"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={generatePacket}
              disabled={packetBusy}
            >
              <FilePlus2 className="h-4 w-4" />
              {packetBusy ? "Generating…" : "Generate lender packet"}
            </Button>
          </div>
        </div>

            <p className="text-xs text-muted-foreground">
              {cures
                ? "Records the submission and clears an open violation. Settling a fine does not."
                : "Filed to the vault only — does not change compliance status."}
            </p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-status-danger">{error}</p>}

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No documents yet. Upload a benchmarking submission or A/RCx report, or
          generate a lender packet.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {d.filename}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {DOC_LABEL[d.doc_type]}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {fmtBytes(d.size_bytes)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => download(d.storage_path)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Set a field on a FormData and return it, for inline action routing. */
function withField(fd: FormData, key: string, value: string): FormData {
  fd.set(key, value);
  return fd;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
