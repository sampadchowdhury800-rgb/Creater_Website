"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin text-cyan-400" />
      ) : (
        <LogOut size={18} className="text-red-400" />
      )}
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
