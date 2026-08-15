import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { deleteProject } from "@/app/admin/actions";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
  });

  async function handleDelete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (id) {
      await deleteProject(id);
      revalidatePath("/admin/projects");
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects Portfolio (Case Studies)</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your engineering case studies, problem-solution statements, and tech stacks (distinct from Automations for sale).
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Create Project
        </Link>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-mono uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Project Title</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Tech Stack</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No projects found. Click &quot;Create Project&quot; to add your first case study.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {project.title}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-cyan-400">
                      {project.role || "Lead Developer"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      /projects/{project.slug}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {project.technologies?.slice(0, 3).join(", ")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          project.status === "PUBLISHED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-950 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/projects/${project.id}`}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                          title="Edit Project"
                        >
                          <Edit3 size={16} />
                        </Link>
                        <form action={handleDelete}>
                          <input type="hidden" name="id" value={project.id} />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-950/60 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete Project"
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
