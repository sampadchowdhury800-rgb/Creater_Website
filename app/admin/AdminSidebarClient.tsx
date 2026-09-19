"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Camera, Play, Image as ImageIcon, FolderTree, Tags, MessageSquare, BarChart, Settings, Bot, Share2, Menu, X } from "lucide-react";
import LogoutButton from "./LogoutButton";

interface AdminSidebarClientProps {
  adminEmail: string;
}

export default function AdminSidebarClient({ adminEmail }: AdminSidebarClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, color: "text-cyan-400" },
    { href: "/admin/posts", label: "All Posts", icon: FileText, color: "text-cyan-400" },
    { href: "/admin/posts?platform=INSTAGRAM", label: "Instagram", icon: Camera, color: "text-pink-400" },
    { href: "/admin/posts?platform=YOUTUBE", label: "YouTube", icon: Play, color: "text-red-400" },
  ];

  const cmsLinks = [
    { href: "/admin/services", label: "Services", icon: Bot, color: "text-cyan-400" },
    { href: "/admin/projects", label: "Projects (Portfolio)", icon: FolderTree, color: "text-blue-400" },
    { href: "/admin/people", label: "People / Founders", icon: Tags, color: "text-pink-400" },
    { href: "/admin/social-profiles", label: "Social Profiles", icon: Share2, color: "text-cyan-400" },
    { href: "/admin/automations", label: "Automations Store", icon: Bot, color: "text-emerald-400" },
    { href: "/admin/media", label: "Media Library", icon: ImageIcon, color: "text-purple-400" },
    { href: "/admin/categories", label: "Categories", icon: FolderTree, color: "text-yellow-400" },
    { href: "/admin/tags", label: "Tags", icon: Tags, color: "text-orange-400" },
    { href: "/admin/comments", label: "Comments", icon: MessageSquare, color: "text-green-400" },
  ];

  const systemLinks = [
    { href: "/admin/gmail-support", label: "Gmail AI Support", icon: Bot, color: "text-indigo-400" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart, color: "text-blue-400" },
    { href: "/admin/settings", label: "Settings", icon: Settings, color: "text-gray-400" },
  ];

  const renderContent = () => (
    <>
      <div className="p-6 border-b border-white/8">
        <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          CMS Admin
        </h2>
        <p className="text-xs text-[#4B5563] mt-0.5 truncate">{adminEmail}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <Icon size={18} className={item.color} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CMS &amp; Portfolio</p>
        </div>

        {cmsLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <Icon size={18} className={item.color} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System</p>
        </div>

        {systemLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              <Icon size={18} className={item.color} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/8 mt-auto">
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#111827] border-r border-white/8 flex-col shrink-0 h-screen sticky top-0">
        {renderContent()}
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#111827] border-b border-white/8 shrink-0">
        <div>
          <h2 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            CMS Admin
          </h2>
          <p className="text-[10px] text-[#4B5563] truncate max-w-[200px]">{adminEmail}</p>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-white bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Toggle Mobile Navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Slide-out Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-[#111827] border-r border-white/8 flex flex-col h-full z-10 shadow-2xl">
            {renderContent()}
          </aside>
        </div>
      )}
    </>
  );
}
