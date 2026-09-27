"use client";

import { useState } from "react";
import type { ImportSummary } from "@/lib/types";

export default function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Import failed");
    setResult(json);
    onImported();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line border-t-4 border-t-accent bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-display text-2xl font-bold tracking-tight">Import an Excel file</h2>
        <p className="mb-4 text-sm text-ink-2">
          Every sheet is read. Creators are matched by Instagram handle, so people already in the dashboard are updated, not duplicated. Your edits
          (genres you verified, status, notes) are kept. Each sheet name becomes a list you can filter by.
        </p>

        {!result && (
          <>
            <input type="file" accept=".xlsx,.xls,.csv" className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={upload} disabled={!file || busy}>{busy ? "Importing…" : "Import"}</button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Num label="New creators" n={result.inserted} />
              <Num label="Updated" n={result.updated} />
              <Num label="Rows skipped" n={result.skippedRows} />
            </div>
            <p className="text-ink-2">
              Read {result.sheetsRead.length} sheet{result.sheetsRead.length === 1 ? "" : "s"}
              {result.sheetsSkipped.length ? `; skipped ${result.sheetsSkipped.join(", ")} (no Instagram links)` : ""}.
            </p>
            {result.skippedExamples.length > 0 && (
              <div>
                <p className="mb-1 text-ink-2">Rows skipped because there was no Instagram profile link (e.g. a reel, YouTube or form link instead):</p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-line text-xs">
                  {result.skippedExamples.map((s, i) => (
                    <div key={i} className="border-t border-line px-2 py-1 first:border-t-0">
                      <span className="text-muted">{s.sheet} row {s.row}:</span> {s.name || "—"} <span className="break-all text-muted">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Num({ label, n }: { label: string; n: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{n.toLocaleString()}</div>
    </div>
  );
}
