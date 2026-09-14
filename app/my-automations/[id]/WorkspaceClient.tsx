"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import MobileMenu from "@/components/MobileMenu";
import Footer from "@/components/Footer";
import {
  Zap,
  ArrowLeft,
  Sliders,
  Activity,
  BarChart2,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Play,
  Loader2,
  XCircle,
  Clock,
  RefreshCw,
  Lock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { AutomationInterfaceRenderer } from "@/components/automations/AutomationInterfaceRenderer";
import { IntegrationStatusCard } from "@/components/automations/IntegrationStatusCard";
import { saveUserAutomationConfig } from "./actions";
import type { ConfigSchema } from "@/lib/automation/validation";

interface WorkspaceClientProps {
  userAutomation: {
    id: string;
    status: string;
    config: Record<string, unknown> | null;
    automation: {
      id: string;
      title: string;
      slug: string;
      shortDesc: string | null;
      description: string | null;
      integrations: string[];
      status: string;
      isExecutable: boolean;
      hasWorkflow?: boolean;
      configSchema: Record<string, unknown> | null;
      category: { name: string } | null;
      files: { id: string; title: string; fileName: string; fileSize?: number | null; fileType?: string | null }[];
    };
  };
}

type ExecutionStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

interface ExecutionRecord {
  id: string;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  error: string | null;
}

function durationLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatusBadge({ status }: { status: ExecutionStatus }) {
  const map: Record<ExecutionStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    QUEUED: {
      label: "Queued",
      cls: "bg-slate-100 dark:bg-surface-container text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10",
      icon: <Clock className="w-3 h-3" />,
    },
    RUNNING: {
      label: "Running",
      cls: "bg-blue-50 dark:bg-cyan-950/40 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/20",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    COMPLETED: {
      label: "Completed",
      cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    FAILED: {
      label: "Failed",
      cls: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/20",
      icon: <XCircle className="w-3 h-3" />,
    },
    CANCELLED: {
      label: "Cancelled",
      cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20",
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const { label, cls, icon } = map[status] ?? map.FAILED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

export default function WorkspaceClient({ userAutomation }: WorkspaceClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "configuration" | "activity" | "usage" | "settings">("overview");

  // Execution state
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null);

  // Configuration save state
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaveResult, setConfigSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Activity / real execution history
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loadingExecs, setLoadingExecs] = useState(false);
  const [execsLoaded, setExecsLoaded] = useState(false);

  const [integrationsSatisfied, setIntegrationsSatisfied] = useState(true);

  const auto = userAutomation.automation;
  const isEngineConfigured = Boolean(auto.hasWorkflow ?? auto.isExecutable);
  const isExecutionAllowed =
    auto.isExecutable &&
    isEngineConfigured &&
    userAutomation.status !== "DISABLED" &&
    userAutomation.status !== "PAUSED" &&
    integrationsSatisfied;

  const fetchExecutions = useCallback(async () => {
    setLoadingExecs(true);
    try {
      const res = await fetch(`/api/automation-executions?userAutomationId=${userAutomation.id}`);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions ?? []);
      }
    } catch {
      // Silently fail — no error shown for background fetch
    } finally {
      setLoadingExecs(false);
      setExecsLoaded(true);
    }
  }, [userAutomation.id]);

  useEffect(() => {
    if (activeTab === "activity" && !execsLoaded) {
      fetchExecutions();
    }
  }, [activeTab, execsLoaded, fetchExecutions]);

  async function handleRunAutomation() {
    if (!isExecutionAllowed || triggering) return;

    setTriggering(true);
    setTriggerResult(null);

    try {
      const res = await fetch("/api/automation-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAutomationId: userAutomation.id,
          input: {},
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTriggerResult({ success: true, message: "Automation triggered successfully." });
        // Refresh activity if on that tab
        setExecsLoaded(false);
      } else {
        setTriggerResult({
          success: false,
          message: data.error || "Execution failed. Please try again.",
        });
      }
    } catch {
      setTriggerResult({
        success: false,
        message: "Connection error. Please try again.",
      });
    } finally {
      setTriggering(false);
    }
  }

  async function handleSaveConfig(values: Record<string, unknown>) {
    setSavingConfig(true);
    setConfigSaveResult(null);
    try {
      const result = await saveUserAutomationConfig(userAutomation.id, values);
      if (result.success) {
        setConfigSaveResult({ success: true, message: "Configuration saved successfully." });
      } else {
        setConfigSaveResult({
          success: false,
          message: result.error || "Failed to save configuration.",
        });
      }
    } catch {
      setConfigSaveResult({
        success: false,
        message: "Connection error. Please try again.",
      });
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200 transition-colors">
      <Navbar videos={[]} onMenuOpen={() => setMenuOpen(true)} />
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} videos={[]} />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/my-automations"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Automations</span>
          </Link>
        </div>

        {/* Workspace Header Card */}
        <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xs mb-8 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {auto?.category && (
                  <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-cyan-950/40 text-blue-700 dark:text-cyan-300 text-xs font-semibold rounded-md border border-blue-100 dark:border-cyan-500/20">
                    {auto.category.name}
                  </span>
                )}
                {!isEngineConfigured ? (
                  <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-bold rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Engine not configured
                  </span>
                ) : !auto.isExecutable ? (
                  <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-surface-container text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-xs font-bold rounded-md flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    Execution disabled
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {auto?.title || "Automation Workspace"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Workspace ID: <code className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-surface-container px-1.5 py-0.5 rounded">{userAutomation.id}</code>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {auto?.slug && (
                <Link
                  href={`/automations/${auto.slug}`}
                  target="_blank"
                  className="px-4 py-2 bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-all text-center"
                >
                  View Product Page
                </Link>
              )}
              {/* Run button — only shown if engine is configured and workspace is active */}
              {isEngineConfigured && auto.isExecutable && userAutomation.status !== "DISABLED" && userAutomation.status !== "PAUSED" && (
                <button
                  onClick={handleRunAutomation}
                  disabled={triggering || !isExecutionAllowed}
                  id="run-automation-btn"
                  title={!integrationsSatisfied ? "Please connect all required integrations before running." : undefined}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-primary hover:bg-slate-700 dark:hover:bg-primary/90 text-white dark:text-black font-bold text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {triggering ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {triggering
                    ? "Triggering..."
                    : !integrationsSatisfied
                    ? "Integration Required"
                    : "Run Automation"}
                </button>
              )}
            </div>
          </div>

          {/* Trigger result feedback */}
          {triggerResult && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
                triggerResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30"
              }`}
            >
              {triggerResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {triggerResult.message}
            </div>
          )}

          {/* Workspace Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-slate-100 dark:border-white/10 scrollbar-none">
            {(["overview", "configuration", "activity", "usage", "settings"] as const).map((tab) => {
              const icons = {
                overview: <Zap className="w-3.5 h-3.5" />,
                configuration: <Sliders className="w-3.5 h-3.5" />,
                activity: <Activity className="w-3.5 h-3.5" />,
                usage: <BarChart2 className="w-3.5 h-3.5" />,
                settings: <Settings className="w-3.5 h-3.5" />,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-slate-900 text-white dark:bg-primary dark:text-black shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-container hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {icons[tab]}
                  <span className="capitalize">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Unpublished Notice */}
        {auto?.status !== "PUBLISHED" && (
          <div className="mb-6 p-4 bg-slate-100 dark:bg-surface-container-low border border-slate-300 dark:border-white/10 rounded-2xl flex items-center gap-3 text-slate-800 dark:text-slate-200">
            <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0" />
            <p className="text-xs font-medium">
              This automation product is no longer publicly listed in the marketplace, but your active workspace access remains intact.
            </p>
          </div>
        )}

        {/* Engine Not Configured Banner */}
        {!isEngineConfigured && (
          <div className="mb-8 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-4 text-amber-900 dark:text-amber-200">
            <Info className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100 mb-1">
                Execution Engine Connection Pending
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Automation setup and real-time execution will become available when this automation product is connected to its execution engine.
              </p>
            </div>
          </div>
        )}

        {/* TAB: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <IntegrationStatusCard
              userAutomationId={userAutomation.id}
              onStatusChange={setIntegrationsSatisfied}
            />

            <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs transition-colors">
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">Product Summary</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                {auto?.shortDesc || auto?.description || "No description provided."}
              </p>

              {auto?.integrations && auto.integrations.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-white/10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Integrations Included</h4>
                  <div className="flex flex-wrap gap-2">
                    {auto.integrations.map((ig: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-blue-50 dark:bg-cyan-950/40 text-blue-700 dark:text-cyan-300 text-xs font-semibold rounded-lg border border-blue-100 dark:border-cyan-500/20">
                        {ig}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {auto?.files && auto.files.length > 0 && (
              <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs transition-colors">
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">Downloadable Product Resources</h3>
                <div className="space-y-2">
                  {auto.files.map((file) => (
                    <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-surface-container border border-slate-200 dark:border-white/10 rounded-xl">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{file.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{file.fileName}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/my-automations/${userAutomation.id}/download/${file.id}`}
                        download
                        className="px-3 py-1.5 bg-blue-600 dark:bg-primary hover:bg-blue-700 dark:hover:bg-primary/90 text-white dark:text-black font-semibold text-xs rounded-lg transition-colors text-center"
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

        {/* TAB: Configuration */}
        {activeTab === "configuration" && (
          <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs transition-colors">
            <div className="flex items-center gap-2 mb-6">
              <Sliders className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Automation Configuration</h3>
            </div>

            {configSaveResult && (
              <div
                className={`mb-5 p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
                  configSaveResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                    : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30"
                }`}
              >
                {configSaveResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {configSaveResult.message}
              </div>
            )}

            <AutomationInterfaceRenderer
              configSchema={auto.configSchema as ConfigSchema | null}
              currentConfig={userAutomation.config as Record<string, unknown> | null}
              onSave={handleSaveConfig}
              saving={savingConfig}
            />
          </div>
        )}

        {/* TAB: Activity — Real Execution History */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">Execution History</h3>
              <button
                onClick={() => { setExecsLoaded(false); fetchExecutions(); }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                disabled={loadingExecs}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingExecs ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {loadingExecs ? (
              <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-8 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading execution history...</span>
              </div>
            ) : executions.length === 0 ? (
              <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-xs transition-colors">
                <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No executions yet</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto">
                  {isExecutionAllowed
                    ? "Click \"Run Automation\" to trigger your first execution."
                    : "Execution run history will appear here once the engine performs real automated workflows."}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden transition-colors">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_120px_120px_90px_120px] gap-4 px-5 py-3 bg-slate-50 dark:bg-surface-container border-b border-slate-100 dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <span>Started</span>
                  <span>Status</span>
                  <span>Completed</span>
                  <span>Duration</span>
                  <span>Details</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {executions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_120px_90px_120px] gap-2 sm:gap-4 px-5 py-4 items-start sm:items-center"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {exec.startedAt
                            ? new Date(exec.startedAt).toLocaleString()
                            : new Date(exec.createdAt).toLocaleString()}
                        </p>
                        {exec.error && (
                          <p className="text-[11px] text-red-500 mt-0.5 line-clamp-1">{exec.error}</p>
                        )}
                      </div>
                      <StatusBadge status={exec.status} />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {exec.completedAt ? new Date(exec.completedAt).toLocaleString() : "—"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {durationLabel(exec.startedAt, exec.completedAt)}
                      </p>
                      <Link
                        href={`/api/automation-executions/${exec.id}`}
                        className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:text-blue-800 dark:hover:text-cyan-300 transition-colors"
                        target="_blank"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Usage */}
        {activeTab === "usage" && (
          <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-xs transition-colors">
            <BarChart2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Usage Metrics</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto">
              Monthly execution volume and quota tracking will populate upon automation activation.
              {/* TODO: Add rate limit display when billing/plan system is implemented */}
            </p>
          </div>
        )}

        {/* TAB: Settings */}
        {activeTab === "settings" && (
          <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-4 transition-colors">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">Workspace Settings</h3>
            <div className="p-4 bg-slate-50 dark:bg-surface-container border border-slate-200 dark:border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Workspace Status</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Current status of this automation instance</p>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-md w-fit ${
                userAutomation.status === "ACTIVE"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  : userAutomation.status === "PAUSED"
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                  : userAutomation.status === "DISABLED"
                  ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/30"
                  : "bg-slate-100 dark:bg-surface-container text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
              }`}>
                {userAutomation.status.replace("_", " ")}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-surface-container border border-slate-200 dark:border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Execution Engine</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Connection status to execution backend</p>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-md w-fit ${
                isEngineConfigured
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
              }`}>
                {isEngineConfigured ? "Connected" : "Not configured"}
              </span>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
