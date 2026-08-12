import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  // We'll wrap in try-catch in case DB isn't connected yet
  let postCount = 0;
  let instagramCount = 0;
  let youtubeCount = 0;

  try {
    postCount = await prisma.post.count();
    instagramCount = await prisma.post.count({ where: { platform: "INSTAGRAM" } });
    youtubeCount = await prisma.post.count({ where: { platform: "YOUTUBE" } });
  } catch {
    console.error("Database not connected yet");
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#171B24] border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="text-[#9BA6B2] text-sm font-medium mb-2">Total Posts</h3>
          <p className="text-4xl font-bold text-white">{postCount}</p>
        </div>
        
        <div className="bg-[#171B24] border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="text-[#9BA6B2] text-sm font-medium mb-2">Instagram Posts</h3>
          <p className="text-4xl font-bold text-[#33D6FF]">{instagramCount}</p>
        </div>

        <div className="bg-[#171B24] border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="text-[#9BA6B2] text-sm font-medium mb-2">YouTube Posts</h3>
          <p className="text-4xl font-bold text-[#FF3333]">{youtubeCount}</p>
        </div>
      </div>
    </div>
  );
}
