import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // If already authenticated, go straight to the dashboard
  const admin = await getAdminSession();
  if (admin) {
    redirect("/admin");
  }

  return <LoginForm />;
}
