"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, humanize } from "@/lib/utils";

export type DevelopmentRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  logline: string | null;
  genre: string | null;
  format: string | null;
  buyerId: string | null;
  buyer: string | null;
  networkOrPlatform: string | null;
  studio: string | null;
  productionCompanies: string[];
  people: string[];
  countryOfOrigin: string | null;
  isInternational: boolean;
  isCoProduction: boolean;
  isAcquisition: boolean;
  announcementDate: string | null;
  lastUpdateDate: string | null;
  sourceUrl: string | null;
  sourcePublication: string | null;
  confidenceScore: number;
  needsReview: boolean;
  notes: string | null;
};

const savedViews = [
  { id: "current", label: "Current Development" },
  { id: "pilot", label: "Pilot Orders" },
  { id: "series", label: "Series Pickups" },
  { id: "acquisitions", label: "Acquisitions" },
  { id: "international", label: "International / Co-Productions" },
  { id: "stale", label: "Stale Projects" },
  { id: "review", label: "Needs Review" }
] as const;

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

function savedViewMatches(row: DevelopmentRow, view: string) {
  if (view === "pilot") return row.status === "pilot_order";
  if (view === "series") return row.status === "series_order";
  if (view === "acquisitions") return row.isAcquisition;
  if (view === "international") return row.isInternational || row.isCoProduction;
  if (view === "stale") return row.status === "stale";
  if (view === "review") return row.needsReview;
  return ["sold", "in_development", "pilot_order", "series_order"].includes(row.status);
}

function booleanFilterMatches(value: boolean, filter: string) {
  if (filter === "yes") return value;
  if (filter === "no") return !value;
  return true;
}

export function DevelopmentTable({ rows }: { rows: DevelopmentRow[] }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "announcementDate", desc: true }]);
  const [savedView, setSavedView] = useState("current");
  const [status, setStatus] = useState("all");
  const [buyer, setBuyer] = useState("all");
  const [studio, setStudio] = useState("all");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const [country, setCountry] = useState("all");
  const [acquisition, setAcquisition] = useState("all");
  const [coProduction, setCoProduction] = useState("all");
  const [international, setInternational] = useState("all");
  const [needsReview, setNeedsReview] = useState("all");

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!savedViewMatches(row, savedView)) return false;
        if (status !== "all" && row.status !== status) return false;
        if (buyer !== "all" && row.buyer !== buyer) return false;
        if (studio !== "all" && row.studio !== studio) return false;
        if (genre !== "all" && row.genre !== genre) return false;
        if (country !== "all" && row.countryOfOrigin !== country) return false;
        if (year !== "all" && new Date(row.announcementDate ?? "").getFullYear().toString() !== year) return false;
        if (!booleanFilterMatches(row.isAcquisition, acquisition)) return false;
        if (!booleanFilterMatches(row.isCoProduction, coProduction)) return false;
        if (!booleanFilterMatches(row.isInternational, international)) return false;
        if (!booleanFilterMatches(row.needsReview, needsReview)) return false;
        return true;
      }),
    [rows, savedView, status, buyer, studio, genre, year, country, acquisition, coProduction, international, needsReview]
  );

  const columns = useMemo<ColumnDef<DevelopmentRow>[]>(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            onClick={row.getToggleExpandedHandler()}
            className="rounded p-1 transition hover:bg-muted"
            aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
          >
            {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )
      },
      {
        accessorKey: "title",
        header: "Project",
        cell: ({ row }) => (
          <div>
            <Link className="font-semibold text-primary hover:underline" href={`/projects/${row.original.id}`}>
              {row.original.title}
            </Link>
            <div className="mt-1 text-xs text-muted-foreground">{humanize(row.original.type)}</div>
          </div>
        )
      },
      {
        accessorKey: "buyer",
        header: "Buyer",
        cell: ({ row }) =>
          row.original.buyerId ? (
            <Link className="font-medium text-primary hover:underline" href={`/buyers/${row.original.buyerId}`}>
              {row.original.buyer ?? "Unknown"}
            </Link>
          ) : (
            row.original.buyer ?? "Unknown"
          )
      },
      { accessorKey: "studio", header: "Studio" },
      { accessorKey: "genre", header: "Genre" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      { accessorKey: "countryOfOrigin", header: "Country" },
      {
        accessorKey: "announcementDate",
        header: "Announced",
        sortingFn: (rowA, rowB) =>
          new Date(rowA.original.announcementDate ?? 0).getTime() - new Date(rowB.original.announcementDate ?? 0).getTime(),
        cell: ({ row }) => formatDate(row.original.announcementDate)
      },
      {
        id: "flags",
        header: "Flags",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.isAcquisition ? <Badge className="bg-orange-50 text-orange-700 ring-orange-200">Acq</Badge> : null}
            {row.original.isCoProduction ? <Badge className="bg-teal-50 text-teal-700 ring-teal-200">Co-Pro</Badge> : null}
            {row.original.isInternational ? <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Intl</Badge> : null}
            {row.original.needsReview ? <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Review</Badge> : null}
          </div>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const haystack = [
        row.original.title,
        row.original.type,
        row.original.status,
        row.original.logline,
        row.original.genre,
        row.original.format,
        row.original.buyer,
        row.original.networkOrPlatform,
        row.original.studio,
        row.original.countryOfOrigin,
        row.original.sourcePublication,
        row.original.sourceUrl,
        row.original.notes,
        ...row.original.productionCompanies,
        ...row.original.people
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel()
  });

  const statuses = unique(rows.map((row) => row.status));
  const buyers = unique(rows.map((row) => row.buyer));
  const studios = unique(rows.map((row) => row.studio));
  const genres = unique(rows.map((row) => row.genre));
  const countries = unique(rows.map((row) => row.countryOfOrigin));
  const years = unique(rows.map((row) => (row.announcementDate ? new Date(row.announcementDate).getFullYear().toString() : null))).sort(
    (a, b) => Number(b) - Number(a)
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="flex flex-wrap gap-2">
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setSavedView(view.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                savedView === view.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search projects, buyers, studios, talent, notes"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
          </Select>
          <Select value={buyer} onChange={(event) => setBuyer(event.target.value)}>
            <option value="all">All buyers</option>
            {buyers.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={studio} onChange={(event) => setStudio(event.target.value)}>
            <option value="all">All studios</option>
            {studios.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="all">All genres</option>
            {genres.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">All years</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="all">All countries</option>
            {countries.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={acquisition} onChange={(event) => setAcquisition(event.target.value)}>
            <option value="all">Acquisition: All</option>
            <option value="yes">Acquisition: Yes</option>
            <option value="no">Acquisition: No</option>
          </Select>
          <Select value={coProduction} onChange={(event) => setCoProduction(event.target.value)}>
            <option value="all">Co-production: All</option>
            <option value="yes">Co-production: Yes</option>
            <option value="no">Co-production: No</option>
          </Select>
          <Select value={international} onChange={(event) => setInternational(event.target.value)}>
            <option value="all">International: All</option>
            <option value="yes">International: Yes</option>
            <option value="no">International: No</option>
          </Select>
          <Select value={needsReview} onChange={(event) => setNeedsReview(event.target.value)}>
            <option value="all">Review: All</option>
            <option value="yes">Review: Needs Review</option>
            <option value="no">Review: Cleared</option>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-panel">
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <div className="text-sm font-medium">{table.getRowModel().rows.length} projects shown</div>
          <div className="text-xs text-muted-foreground">Saved view: {savedViews.find((view) => view.id === savedView)?.label}</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-white">
                  {headerGroup.headers.map((header) => (
                    <Th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          disabled={!header.column.getCanSort()}
                          className="inline-flex items-center gap-1 disabled:cursor-default"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() ? (
                            header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                            )
                          ) : null}
                        </button>
                      )}
                    </Th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="hover:bg-slate-50">
                    {row.getVisibleCells().map((cell) => (
                      <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                    ))}
                  </tr>
                  {row.getIsExpanded() ? (
                    <tr>
                      <Td colSpan={columns.length} className="bg-slate-50">
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Logline</div>
                            <p className="mt-1 text-sm leading-6">{row.original.logline ?? "No logline yet."}</p>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Production Companies</div>
                            <p className="mt-1 text-sm">{row.original.productionCompanies.join(", ") || "None logged"}</p>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">People</div>
                            <p className="mt-1 text-sm">{row.original.people.join(", ") || "None logged"}</p>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Last Update</div>
                            <p className="mt-1 text-sm">{formatDate(row.original.lastUpdateDate)}</p>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Source</div>
                            <div className="mt-1 text-sm">
                              <div>{row.original.sourcePublication ?? "Unknown"}</div>
                              {row.original.sourceUrl ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={row.original.sourceUrl} target="_blank" rel="noreferrer">
                                  Source URL <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Confidence</div>
                            <p className="mt-1 text-sm">{Math.round(row.original.confidenceScore * 100)}%</p>
                          </div>
                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Notes</div>
                            <p className="mt-1 text-sm">{row.original.notes ?? "No notes logged."}</p>
                          </div>
                          <Link className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={`/projects/${row.original.id}`}>
                            Open project detail <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
