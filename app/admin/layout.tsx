import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import AdminSidebarClient from "./AdminSidebarClient";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0A0D14] text-white overflow-hidden">
      <AdminSidebarClient adminEmail={admin.email} />
      <main className="flex-1 overflow-y-auto w-full">{children}</main>
    </div>
  );
}
