import {
  Building2,
  CalendarDays,
  ClipboardList,
  CopyMinus,
  FileText,
  Bell,
  Mail,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldCheck,
  Play,
  History,
  UsersRound,
  Eye,
  MessageSquarePlus
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }]
  },
  {
    label: "Development",
    items: [
      { href: "/development", label: "Development Tracker", icon: ClipboardList },
      { href: "/buyers", label: "Buyers", icon: Building2 },
      { href: "/companies", label: "Companies & Talent", icon: UsersRound }
    ]
  },
  {
    label: "Current TV",
    items: [{ href: "/current-tv", label: "Current TV Tracker", icon: Radio }]
  },
  {
    label: "Reports",
    items: [
      { href: "/weekly-reports", label: "Weekly Reports", icon: CalendarDays },
      { href: "/watchlists", label: "Watchlists", icon: Eye },
      { href: "/alerts", label: "Alerts", icon: Bell }
    ]
  },
  {
    label: "Ingestion",
    items: [
      { href: "/review", label: "Review Queue", icon: FileText },
      { href: "/duplicates", label: "Duplicate Review", icon: CopyMinus },
      { href: "/sources", label: "Sources & Intake", icon: Settings }
    ]
  },
  {
    label: "Admin",
    items: [
      { href: "/settings/notifications", label: "Email Preferences", icon: Mail, adminOnly: true },
      { href: "/admin/feedback", label: "Feedback Inbox", icon: MessageSquarePlus, adminOnly: true },
      { href: "/admin/status", label: "Admin Status", icon: ShieldCheck, adminOnly: true },
      { href: "/admin/launch-checklist", label: "Launch Checklist", icon: ClipboardList, adminOnly: true },
      { href: "/admin/jobs", label: "Background Jobs", icon: Play, adminOnly: true },
      { href: "/admin/audit-log", label: "Audit Log", icon: History, adminOnly: true }
    ]
  }
];

export const navItems = navGroups.flatMap((group) => group.items);

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
