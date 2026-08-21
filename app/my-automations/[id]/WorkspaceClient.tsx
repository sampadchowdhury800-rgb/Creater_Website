"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Zap, ArrowLeft, Sliders, Activity, BarChart2, Settings, AlertTriangle, Info, CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

interface WorkspaceClientProps {
  userAutomation: any;
}

export default function WorkspaceClient({ userAutomation }: WorkspaceClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "configuration" | "activity" | "usage" | "settings">("overview");

  const auto = userAutomation.automation;

  return (
    <ThemeProvider>
      <div className="bg-[#FAFAFA] dark:bg-[#FAFAFA] text-slate-900 min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
        <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
        <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

        <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          {/* Breadcrumb & Navigation */}
          <div className="mb-6">
            <Link
              href="/my-automations"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My Automations</span>
            </Link>
          </div>

          {/* Workspace Header Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {auto?.category && (
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md border border-blue-100">
                      {auto.category.name}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Not configured
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {auto?.title || "Automation Workspace"}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Workspace ID: <code className="font-mono text-xs text-slate-700">{userAutomation.id}</code>
                </p>
              </div>

              {auto?.slug && (
                <Link
                  href={`/automations/${auto.slug}`}
                  target="_blank"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all self-start sm:self-center"
                >
                  View Product Page
                </Link>
              )}
            </div>

            {/* Workspace Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-slate-100 scrollbar-none">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab("configuration")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "configuration"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configuration</span>
              </button>

              <button
                onClick={() => setActiveTab("activity")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "activity"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Activity</span>
              </button>

              <button
                onClick={() => setActiveTab("usage")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "usage"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Usage</span>
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* CRITICAL HONEST NOTICE BANNER */}
          <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-4 text-amber-900">
            <Info className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950 mb-1">
                Execution Engine Connection Pending
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Automation setup and real-time execution will become available when this automation product is connected to its execution engine.
              </p>
            </div>
          </div>

          {/* TAB CONTENTS */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h3 className="font-bold text-base text-slate-900 mb-3">Product Summary</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  {auto?.shortDesc || auto?.description || "No description provided."}
                </p>

                {auto?.integrations && auto.integrations.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Integrations Included</h4>
                    <div className="flex flex-wrap gap-2">
                      {auto.integrations.map((ig: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                          {ig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {auto?.files && auto.files.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <h3 className="font-bold text-base text-slate-900 mb-4">Downloadable Product Resources</h3>
                  <div className="space-y-2">
                    {auto.files.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{file.title}</p>
                            <p className="text-[11px] text-slate-500">{file.fileName}</p>
                          </div>
                        </div>
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Download Resource
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "configuration" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
              <Sliders className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">Configuration Unavailable</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                No active configuration fields are required for this workspace until the execution engine layer is configured.
              </p>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No Activity Logs</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                Execution run history will appear here once the engine performs real automated workflows.
              </p>
            </div>
          )}

          {activeTab === "usage" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
              <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No Usage Metrics</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                Monthly execution volume and webhook quota tracking will populate upon automation activation.
              </p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-slate-900 mb-2">Workspace Settings</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Workspace Status</p>
                  <p className="text-[11px] text-slate-500">Current status of this automation instance</p>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-md">
                  Not configured
                </span>
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </ThemeProvider>
  );
}
