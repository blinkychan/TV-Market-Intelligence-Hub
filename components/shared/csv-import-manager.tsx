"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { parseCsvText } from "@/lib/csv";
import { guessCsvMapping, getImportFields, IMPORT_ENTITY_OPTIONS, type ImportEntityType } from "@/lib/import-config";
import type { ImportPreviewResult } from "@/lib/data-transfer";

type CsvImportManagerProps = {
  canImport: boolean;
};

type CsvState = {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: Record<string, string>;
};

function getValue(row: string[], headers: string[], key: string) {
  const index = headers.indexOf(key);
  return index >= 0 ? row[index] ?? "" : "";
}

export function CsvImportManager({ canImport }: CsvImportManagerProps) {
  const [entityType, setEntityType] = useState<ImportEntityType>("projects");
  const [csvState, setCsvState] = useState<CsvState | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fields = useMemo(() => getImportFields(entityType), [entityType]);

  function resetState(nextEntityType: ImportEntityType) {
    setEntityType(nextEntityType);
    setCsvState(null);
    setPreview(null);
    setMessage(null);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvText(text);
    setCsvState({
      fileName: file.name,
      headers: parsed.headers,
      rows: parsed.rows,
      mapping: guessCsvMapping(entityType, parsed.headers)
    });
    setPreview(null);
    setMessage(null);
  }

  function updateMapping(fieldKey: string, header: string) {
    setCsvState((current) => (current ? { ...current, mapping: { ...current.mapping, [fieldKey]: header } } : current));
  }

  function buildRows() {
    if (!csvState) return [];
    return csvState.rows.map((row) =>
      Object.fromEntries(
        fields.map((field) => [field.key, getValue(row, csvState.headers, csvState.mapping[field.key] ?? "")])
      )
    );
  }

  async function runPreview() {
    if (!csvState) return;
    setLoadingPreview(true);
    setMessage(null);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, rows: buildRows() })
    });
    const payload = (await response.json().catch(() => null)) as ImportPreviewResult | { error?: string } | null;
    setLoadingPreview(false);
    if (!response.ok) {
      setMessage(payload && "error" in payload ? payload.error ?? "Preview failed." : "Preview failed.");
      return;
    }
    setPreview(payload as ImportPreviewResult);
  }

  async function confirmImport() {
    if (!csvState || !preview?.databaseWritable) return;
    setImporting(true);
    setMessage(null);
    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, rows: buildRows() })
    });
    const payload = (await response.json().catch(() => null)) as
      | { created?: number; skippedDuplicates?: number; skippedErrors?: number; error?: string }
      | null;
    setImporting(false);
    if (!response.ok) {
      setMessage(payload?.error ?? "Import failed.");
      return;
    }
    setMessage(
      `Import finished: ${payload?.created ?? 0} created, ${payload?.skippedDuplicates ?? 0} duplicates skipped, ${payload?.skippedErrors ?? 0} invalid rows skipped.`
    );
  }

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle>CSV Import Manager</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a file, map the columns, preview duplicate and validation warnings, then confirm the import.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[16rem_1fr_auto]">
          <Select value={entityType} onChange={(event) => resetState(event.target.value as ImportEntityType)} disabled={!canImport}>
            {IMPORT_ENTITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/-/g, " ")}
              </option>
            ))}
          </Select>
          <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={!canImport} />
          <Button type="button" onClick={runPreview} disabled={!csvState || loadingPreview || !canImport}>
            <Upload className="h-4 w-4" /> {loadingPreview ? "Previewing..." : "Preview Import"}
          </Button>
        </div>

        {!canImport ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Your current role can export data, but imports are limited to editors and admins.
          </div>
        ) : null}

        {csvState ? (
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> {csvState.fileName} · {csvState.rows.length} rows detected
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <label key={field.key} className="space-y-1 text-sm">
                  <span className="font-medium">{field.label}</span>
                  <Select value={csvState.mapping[field.key] ?? ""} onChange={(event) => updateMapping(field.key, event.target.value)}>
                    <option value="">Ignore this field</option>
                    {csvState.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    {csvState.headers.slice(0, 6).map((header) => (
                      <Th key={header}>{header}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvState.rows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={`preview-${rowIndex}`}>
                      {row.slice(0, 6).map((cell, cellIndex) => (
                        <Td key={`preview-${rowIndex}-${cellIndex}`}>{cell}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4 rounded-lg border bg-white p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <SummaryCard label="Ready to import" value={preview.acceptedCount} />
              <SummaryCard label="Possible duplicates" value={preview.duplicateCount} />
              <SummaryCard label="Validation errors" value={preview.errorCount} />
              <SummaryCard label="Storage mode" value={preview.databaseWritable ? "Database" : "Preview only"} />
            </div>
            {!preview.databaseWritable ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Database write access is unavailable in this environment, so the flow can preview the import but not commit it.
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Row</Th>
                    <Th>Warnings</Th>
                    <Th>Errors</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 12).map((row) => (
                    <tr key={row.rowNumber}>
                      <Td>Row {row.rowNumber}</Td>
                      <Td className="text-sm text-muted-foreground">{row.warnings.join(" ") || "None"}</Td>
                      <Td className="text-sm text-rose-700">{row.errors.join(" ") || "None"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={confirmImport} disabled={importing || !preview.databaseWritable || preview.acceptedCount === 0}>
                <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Confirm Import"}
              </Button>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Imports create audit logs and skip duplicates instead of overwriting them.
              </div>
            </div>
          </div>
        ) : null}

        {message ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</div> : null}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
