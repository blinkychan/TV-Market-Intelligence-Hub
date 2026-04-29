import {
  Building2,
  CalendarDays,
  ClipboardList,
  CopyMinus,
  FileText,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldCheck,
  History,
  UsersRound
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/development", label: "Development Tracker", icon: ClipboardList },
  { href: "/current-tv", label: "Current TV Tracker", icon: Radio },
  { href: "/buyers", label: "Buyers", icon: Building2 },
  { href: "/companies", label: "Companies & Talent", icon: UsersRound },
  { href: "/review", label: "Article Review Queue", icon: FileText },
  { href: "/duplicates", label: "Duplicate Review", icon: CopyMinus },
  { href: "/weekly-reports", label: "Weekly Reports", icon: CalendarDays },
  { href: "/sources", label: "Sources / Ingestion", icon: Settings },
  { href: "/admin/status", label: "Admin Status", icon: ShieldCheck },
  { href: "/admin/audit-log", label: "Admin Audit Log", icon: History }
];

export const statusTone: Record<string, string> = {
  sold: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_development: "bg-sky-50 text-sky-700 ring-sky-200",
  pilot_order: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  series_order: "bg-violet-50 text-violet-700 ring-violet-200",
  airing: "bg-teal-50 text-teal-700 ring-teal-200",
  "premiering soon": "bg-sky-50 text-sky-700 ring-sky-200",
  returning: "bg-lime-50 text-lime-700 ring-lime-200",
  "finale soon": "bg-amber-50 text-amber-800 ring-amber-200",
  renewed: "bg-lime-50 text-lime-700 ring-lime-200",
  canceled: "bg-rose-50 text-rose-700 ring-rose-200",
  passed: "bg-stone-100 text-stone-700 ring-stone-200",
  stale: "bg-amber-50 text-amber-800 ring-amber-200",
  unknown: "bg-slate-100 text-slate-700 ring-slate-200"
};
