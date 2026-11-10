"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "./ui";
import { Logo } from "./logo";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: ClipboardList },
  { href: "/chat", label: "Coach", icon: Sparkles },
  { href: "/suggestions", label: "Suggestions", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#080d13]/90 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4.5 w-4.5",
                    active ? "text-emerald-300" : "text-zinc-500 group-hover:text-zinc-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#070a0f]/80 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#080d13]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-emerald-400" : "text-zinc-500"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
