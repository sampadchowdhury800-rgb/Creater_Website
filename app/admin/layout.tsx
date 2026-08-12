import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { LayoutDashboard, FileText, Camera, Play, Image as ImageIcon, FolderTree, Tags, MessageSquare, BarChart, Settings, Bot } from "lucide-react";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout only wraps /admin and /admin/* (not /admin/login,
  // which now lives in app/(admin-auth)/login/).
  // Full DB session validation happens here — middleware only does a
  // lightweight cookie-presence check for speed.
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="flex h-screen bg-[#0A0D14] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] border-r border-white/8 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-white/8">
          <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            CMS Admin
          </h2>
          <p className="text-xs text-[#4B5563] mt-0.5 truncate">{admin.email}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <LayoutDashboard size={18} className="text-cyan-400" />
            Dashboard
          </Link>
          <Link
            href="/admin/posts"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <FileText size={18} className="text-cyan-400" />
            All Posts
          </Link>
          <Link
            href="/admin/posts?platform=INSTAGRAM"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Camera size={18} className="text-pink-400" />
            Instagram
          </Link>
          <Link
            href="/admin/posts?platform=YOUTUBE"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Play size={18} className="text-red-400" />
            YouTube
          </Link>

          <div className="pt-4 pb-2 px-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CMS</p>
          </div>
          
          <Link
            href="/admin/automations"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Bot size={18} className="text-emerald-400" />
            Automations
          </Link>
          <Link
            href="/admin/media"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <ImageIcon size={18} className="text-purple-400" />
            Media Library
          </Link>
          <Link
            href="/admin/categories"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <FolderTree size={18} className="text-yellow-400" />
            Categories
          </Link>
          <Link
            href="/admin/tags"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Tags size={18} className="text-orange-400" />
            Tags
          </Link>
          <Link
            href="/admin/comments"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <MessageSquare size={18} className="text-green-400" />
            Comments
          </Link>

          <div className="pt-4 pb-2 px-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System</p>
          </div>
          
          <Link
            href="/admin/analytics"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <BarChart size={18} className="text-blue-400" />
            Analytics
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-[#D1D5DB] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Settings size={18} className="text-gray-400" />
            Settings
          </Link>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/8">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
