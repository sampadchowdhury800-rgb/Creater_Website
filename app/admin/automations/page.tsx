import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import Link from "next/link";
import { Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import DeleteAutomationButton from "./DeleteAutomationButton";

export const metadata = {
  title: "Manage Automations | Admin",
};

export default async function AdminAutomationsPage() {
  await requireAdminSession();

  const automations = await prisma.automation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      _count: {
        select: { orderItems: true }
      }
    }
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Automations</h1>
          <p className="text-on-surface-variant text-sm">Manage marketplace products</p>
        </div>
        <Link
          href="/admin/automations/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container font-medium rounded-xl transition-colors"
        >
          <Plus size={18} />
          New Automation
        </Link>
      </div>

      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-on-surface-variant">
              <tr>
                <th className="px-6 py-4 font-medium">Product</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Sales</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[#E5E7EB]">
              {automations.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{item.title}</span>
                      <span className="text-xs text-on-surface-variant">/{item.slug}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">₹{(item.price / 100).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                      item.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-400' :
                      item.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{item._count.orderItems}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link 
                        href={`/automations/${item.slug}`} 
                        target="_blank"
                        className="p-2 text-on-surface-variant hover:text-white transition-colors"
                        title="View Live"
                      >
                        <ExternalLink size={18} />
                      </Link>
                      <Link 
                        href={`/admin/automations/${item.id}`}
                        className="p-2 text-primary-fixed-dim hover:text-primary-fixed transition-colors"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </Link>
                      <DeleteAutomationButton id={item.id} title={item.title} />
                    </div>
                  </td>
                </tr>
              ))}
              {automations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                    No automations found. Create your first product!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
