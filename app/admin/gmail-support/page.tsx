import React from "react";
import GmailSupportDashboard from "@/components/automations/GmailSupportDashboard";

export const metadata = {
  title: "Gmail AI Support Engine | Admin",
  description: "Manage multi-tenant Gmail AI Customer Support automation backend",
};

export default function AdminGmailSupportPage() {
  return (
    <div className="space-y-6">
      <GmailSupportDashboard />
    </div>
  );
}
