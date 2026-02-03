"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Bell,
  Brain,
  Newspaper,
  Settings,
  TrendingUp,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portafoglio", icon: Briefcase },
  { href: "/assets", label: "Asset", icon: BarChart3 },
  { href: "/trading", label: "Trading", icon: LineChart },
  { href: "/alerts", label: "Alert", icon: Bell },
  { href: "/analysis", label: "Analisi AI", icon: Brain },
  { href: "/news", label: "Notizie", icon: Newspaper },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow border-r bg-card overflow-y-auto">
        <div className="flex items-center h-16 px-6 border-b">
          <TrendingUp className="h-6 w-6 text-primary mr-2" />
          <span className="text-xl font-bold">Financy</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
