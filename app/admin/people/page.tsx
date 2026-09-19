import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { deletePerson } from "@/app/admin/actions";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const people = await prisma.person.findMany({
    orderBy: { sortOrder: "asc" },
  });

  async function handleDelete(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (id) {
      await deletePerson(id);
      revalidatePath("/admin/people");
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">People / Founders Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage founder profiles, personal brand entity data, biographies, skills, experience, and official social URLs.
          </p>
        </div>
        <Link
          href="/admin/people/new"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Person
        </Link>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-mono uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Title / Role</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Founder</th>
                <th className="px-6 py-4">Social Links</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {people.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No people found. Click &quot;Add Person&quot; to create a founder profile.
                  </td>
                </tr>
              ) : (
                people.map((person) => (
                  <tr key={person.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {person.name}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-cyan-400">
                      {person.title}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {person.slug}
                    </td>
                    <td className="px-6 py-4">
                      {person.isFounder ? (
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                          Founder
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-white/5 text-gray-400">
                          Member
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      <div className="flex gap-2">
                        {person.linkedin && (
                          <a
                            href={person.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0077b5] hover:underline"
                          >
                            LinkedIn
                          </a>
                        )}
                        {person.github && (
                          <a
                            href={person.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:underline"
                          >
                            GitHub
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/people/${person.id}`}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                          title="Edit Person"
                        >
                          <Edit3 size={16} />
                        </Link>
                        <form action={handleDelete}>
                          <input type="hidden" name="id" value={person.id} />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-950/60 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete Person"
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
