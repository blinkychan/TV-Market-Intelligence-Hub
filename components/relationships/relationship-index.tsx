"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SavedViewsPanel } from "@/components/shared/saved-views-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { SavedViewRecord } from "@/lib/saved-views";
import type { NetworkNode, RelationshipIndexData } from "@/components/relationships/types";
import { humanize } from "@/lib/utils";

export function RelationshipIndex({
  data,
  dataSource,
  errorMessage,
  companySavedViews = [],
  peopleSavedViews = [],
  currentUserEmail = null,
  canCreateTeamView = false,
  canManageAllSavedViews = false
}: {
  data: RelationshipIndexData;
  dataSource: "database" | "mock";
  errorMessage?: string;
  companySavedViews?: SavedViewRecord[];
  peopleSavedViews?: SavedViewRecord[];
  currentUserEmail?: string | null;
  canCreateTeamView?: boolean;
  canManageAllSavedViews?: boolean;
}) {
  const [tab, setTab] = useState<"companies" | "people" | "map">("companies");
  const [query, setQuery] = useState("");

  function applySavedView(view: SavedViewRecord) {
    const filters = (view.filtersJson ?? {}) as Record<string, unknown>;
    const nextTab = String(filters.tab ?? "companies");
    setTab(nextTab === "people" ? "people" : nextTab === "map" ? "map" : "companies");
    setQuery(String(filters.query ?? ""));
  }

  const activeSavedViews = tab === "people" ? peopleSavedViews : companySavedViews;

  return (
    <div className="space-y-5">
      <SavedViewsPanel
        pageType={tab === "people" ? "people" : "companies"}
        savedViews={activeSavedViews}
        returnPath="/companies"
        currentState={{ filtersJson: { tab, query } }}
        canCreateTeamView={canCreateTeamView}
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllSavedViews}
        canWrite={dataSource === "database"}
        onLoadView={applySavedView}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-panel">
        <div className="flex flex-wrap gap-2">
          {[
            ["companies", "Companies"],
            ["people", "People"],
            ["map", "Relationship Map"]
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
          Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
        </Badge>
      </div>
      {errorMessage ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Database unavailable, showing mock preview data. Detail: {errorMessage}</div> : null}
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies, talent, buyers, or connected entities" />
      </div>
      {tab === "companies" ? <CompaniesTab data={data} query={query} /> : null}
      {tab === "people" ? <PeopleTab data={data} query={query} /> : null}
      {tab === "map" ? <RelationshipMap data={data} /> : null}
    </div>
  );
}

function CompaniesTab({ data, query }: { data: RelationshipIndexData; query: string }) {
  const filteredCompanies = data.companies.filter((company) =>
    [company.name, company.type, ...company.connectedBuyers, ...company.connectedPeople].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  if (!filteredCompanies.length) return <EmptyState text="No companies available." />;
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-panel">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
          <tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Projects</th><th className="p-3">Connected Buyers</th><th className="p-3">Connected People</th></tr>
        </thead>
        <tbody>
          {filteredCompanies.map((company) => (
            <tr key={company.id} className="border-t hover:bg-slate-50">
              <td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/companies/${company.id}`}>{company.name}</Link></td>
              <td className="p-3">{humanize(company.type)}</td>
              <td className="p-3">{company.projectCount}</td>
              <td className="p-3">{company.connectedBuyers.join(", ") || "None"}</td>
              <td className="p-3">{company.connectedPeople.join(", ") || "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleTab({ data, query }: { data: RelationshipIndexData; query: string }) {
  const filteredPeople = data.people.filter((person) =>
    [person.name, person.role, person.company, person.reps, ...person.connectedBuyers, ...person.connectedCompanies].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  if (!filteredPeople.length) return <EmptyState text="No people available." />;
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-panel">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted-foreground">
          <tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Company / Reps</th><th className="p-3">Projects</th><th className="p-3">Connected Buyers</th><th className="p-3">Connected Companies</th></tr>
        </thead>
        <tbody>
          {filteredPeople.map((person) => (
            <tr key={person.id} className="border-t hover:bg-slate-50">
              <td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/talent/${person.id}`}>{person.name}</Link></td>
              <td className="p-3">{humanize(person.role)}</td>
              <td className="p-3">{[person.company, person.reps].filter(Boolean).join(" / ") || "None"}</td>
              <td className="p-3">{person.projectCount}</td>
              <td className="p-3">{person.connectedBuyers.join(", ") || "None"}</td>
              <td className="p-3">{person.connectedCompanies.join(", ") || "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelationshipMap({ data }: { data: RelationshipIndexData }) {
  const [buyer, setBuyer] = useState("all");
  const [company, setCompany] = useState("all");
  const [person, setPerson] = useState("all");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("all");
  const [selected, setSelected] = useState<NetworkNode | null>(null);

  const buyers = data.nodes.filter((node) => node.type === "buyer");
  const companies = data.nodes.filter((node) => node.type === "company");
  const people = data.nodes.filter((node) => node.type === "person");
  const statuses = Array.from(new Set(data.edges.map((edge) => edge.projectStatus).filter(Boolean) as string[])).sort();
  const years = Array.from(new Set(data.edges.map((edge) => edge.year).filter(Boolean) as string[])).sort((a, b) => Number(b) - Number(a));

  const visibleEdges = data.edges.filter((edge) => {
    if (status !== "all" && edge.projectStatus !== status) return false;
    if (year !== "all" && edge.year !== year) return false;
    if (buyer !== "all" && edge.from !== buyer && edge.to !== buyer) return false;
    if (company !== "all" && edge.from !== company && edge.to !== company) return false;
    if (person !== "all" && edge.from !== person && edge.to !== person) return false;
    return true;
  });
  const visibleNodeIds = new Set(visibleEdges.flatMap((edge) => [edge.from, edge.to]));
  const visibleNodes = data.nodes.filter((node) => visibleNodeIds.has(node.id));
  const connected = selected ? visibleEdges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <Card className="shadow-panel">
        <CardHeader><CardTitle>Relationship Map</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={buyer} onChange={(event) => setBuyer(event.target.value)}><option value="all">All buyers</option>{buyers.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</Select>
            <Select value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All companies</option>{companies.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</Select>
            <Select value={person} onChange={(event) => setPerson(event.target.value)}><option value="all">All people</option>{people.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</Select>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          </div>
          {visibleNodes.length ? (
            <div className="min-h-96 rounded-lg border bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-center gap-4">
                {visibleNodes.map((node) => (
                  <button key={node.id} onClick={() => setSelected(node)} className={`rounded-full border px-4 py-3 text-sm font-semibold shadow-sm transition hover:shadow-panel ${node.type === "buyer" ? "bg-primary text-white" : node.type === "project" ? "bg-white text-slate-900" : node.type === "person" ? "bg-teal-50 text-teal-800" : "bg-sky-50 text-sky-800"}`}>
                    {node.label}
                    <span className="ml-2 text-xs opacity-75">{node.type}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : <EmptyState text="No relationship nodes match these filters." />}
        </CardContent>
      </Card>
      <Card className="shadow-panel">
        <CardHeader><CardTitle>{selected ? selected.label : "Select a Node"}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selected?.href ? <Link className="font-medium text-primary hover:underline" href={selected.href}>Open detail page</Link> : null}
          {connected.length ? connected.map((edge, index) => {
            const otherId = edge.from === selected?.id ? edge.to : edge.from;
            const other = data.nodes.find((node) => node.id === otherId);
            return <div key={`${edge.from}-${edge.to}-${index}`} className="rounded-md border p-3"><div className="font-medium">{other?.label ?? otherId}</div><div className="text-muted-foreground">{humanize(edge.projectStatus)} · {edge.year ?? "Unknown year"}</div></div>;
          }) : <div className="text-muted-foreground">Click a node to see connected records.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
