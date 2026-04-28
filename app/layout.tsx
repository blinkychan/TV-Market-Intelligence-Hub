import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { navItems } from "@/lib/constants";
import { Search } from "lucide-react";

export const metadata: Metadata = {
  title: "TV Market Intelligence Hub",
  description: "Local-first entertainment industry intelligence dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-background">
          <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-slate-950 text-white lg:block">
            <div className="flex h-20 items-center border-b border-white/10 px-6">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">Local Intel</div>
                <div className="text-xl font-semibold">TV Market Hub</div>
              </div>
            </div>
            <nav className="space-y-1 px-3 py-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="lg:pl-72">
            <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
              <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
                <div className="lg:hidden">
                  <div className="font-semibold">TV Market Hub</div>
                </div>
                <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground md:flex">
                  <Search className="h-4 w-4" />
                  Search projects, buyers, companies, people, sources
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
                    Local SQLite
                  </span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700 ring-1 ring-sky-200">
                    No cloud required
                  </span>
                </div>
              </div>
            </header>
            <main className="executive-grid min-h-[calc(100vh-4rem)] p-4 lg:p-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
