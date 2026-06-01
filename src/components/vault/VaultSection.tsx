"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Download, FileText, FilePlus2 } from "lucide-react";
import {
  uploadDocumentAction,
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

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function VaultSection({
  buildingId,
  documents,
}: {
  buildingId: string;
  documents: DocumentRow[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("benchmark_submission");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [packetBusy, startPacket] = useTransition();

  function upload() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const fd = new FormData();
    fd.set("buildingId", buildingId);
    fd.set("docType", docType);
    fd.set("file", file);
    start(async () => {
      const res = await uploadDocumentAction(fd);
      if (res?.error) setError(res.error);
      else if (fileRef.current) fileRef.current.value = "";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Document type
          </label>
          <Select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
          >
            <option value="benchmark_submission">Benchmarking submission</option>
            <option value="arcx_report">A/RCx report</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="flex-1">
          <input
            ref={fileRef}
            type="file"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
        <Button type="button" onClick={upload} disabled={busy}>
          <Upload className="h-4 w-4" />
          {busy ? "Uploading…" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={generatePacket}
          disabled={packetBusy}
        >
          <FilePlus2 className="h-4 w-4" />
          {packetBusy ? "Generating…" : "Generate lender packet"}
        </Button>
      </div>

      {error && <p className="text-sm text-status-danger">{error}</p>}

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No documents yet. Upload a benchmarking submission or A/RCx report, or
          generate a lender packet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
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
