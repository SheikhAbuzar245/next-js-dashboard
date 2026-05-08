"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  Calendar,
  Users,
  BarChart3,
  Settings,
  Dumbbell,
  PhoneCall,
  Menu,
  X,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import Vapi from "@vapi-ai/web";

function SidebarCallButton({ onNav }: { onNav?: () => void }) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  async function toggle() {
    if (active) {
      vapiRef.current?.stop();
      setActive(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/vapi-setup");
      const { assistantId } = await res.json();
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
      vapiRef.current = vapi;
      vapi.on("call-start", () => { setActive(true); setLoading(false); });
      vapi.on("call-end", () => { setActive(false); setLoading(false); vapiRef.current = null; });
      vapi.on("error", () => { setActive(false); setLoading(false); vapiRef.current = null; });
      await vapi.start(assistantId);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-700 hover:bg-green-100"
      )}
    >
      <PhoneCall className={cn("w-4 h-4 shrink-0", loading && "animate-pulse")} />
      {loading ? "Connecting..." : active ? "End Call" : "Call Sara"}
    </button>
  );
}

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/bookings", label: "Bookings", icon: Calendar },
  { href: "/members", label: "Members", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: DollarSign },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">PowerFit</p>
            <p className="text-xs text-gray-500">AI Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <SidebarCallButton onNav={onNav} />
        <div className="flex items-center gap-2 px-3 py-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
          <span className="text-xs text-gray-500">AI Agent Active</span>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">PowerFit AI</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">PowerFit AI</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent onNav={() => setOpen(false)} />
      </aside>
    </>
  );
}
