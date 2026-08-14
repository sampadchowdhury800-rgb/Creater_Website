import { Metadata } from "next";
import AchievementsClient from "./AchievementsClient";

export const metadata: Metadata = {
  title: "Achievements & Milestones | Chowdhury Duo",
  description: "Explore the creator journey, awards, channel milestones, and community achievements of Chowdhury Duo.",
  openGraph: {
    title: "Achievements & Milestones | Chowdhury Duo",
    description: "Explore the creator journey, awards, and milestones of Chowdhury Duo.",
    url: "https://chowdhuryduo.com/achievements",
  },
};

export default function AchievementsPage() {
  return <AchievementsClient />;
}
