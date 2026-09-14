import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { deleteService } from "@/app/admin/actions";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
  });

  async function handleDelete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (id) {
      await deleteService(id);
      revalidatePath("/admin/services");
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Services Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your service offerings, capabilities, features, use cases, and SEO/AEO fields.
          </p>
        </div>
        <Link
          href="/admin/services/new"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Service
        </Link>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-mono uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Service Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Features</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No services found. Click &quot;Create Service&quot; to add your first offering.
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {service.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
                        {service.category || "General"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      /services/{service.slug}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {service.features?.length || 0} features
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          service.status === "PUBLISHED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-950 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {service.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/services/${service.id}`}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                          title="Edit Service"
                        >
                          <Edit3 size={16} />
                        </Link>
                        <form action={handleDelete}>
                          <input type="hidden" name="id" value={service.id} />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-950/60 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete Service"
                          >
                            <Trash2 size={16} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
