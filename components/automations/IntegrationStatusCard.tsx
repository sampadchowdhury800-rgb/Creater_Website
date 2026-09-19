"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { GmailConnectModal } from "./GmailConnectModal";

export interface IntegrationRequirement {
  id: string;
  provider: "GOOGLE";
  capability: string;
  required: boolean;
  label: string;
  description: string;
}

export interface BoundIntegration {
  id: string;
  role: string;
  connection: {
    id: string;
    provider: string;
    accountEmail: string | null;
    status: "CONNECTED" | "DISCONNECTED" | "EXPIRED" | "ERROR";
    lastRefreshedAt: string | null;
    createdAt: string;
  } | null;
}

interface IntegrationStatusCardProps {
  userAutomationId: string;
  onStatusChange?: (allSatisfied: boolean) => void;
}

export function IntegrationStatusCard({
  userAutomationId,
  onStatusChange,
}: IntegrationStatusCardProps) {
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<IntegrationRequirement[]>([]);
  const [boundIntegrations, setBoundIntegrations] = useState<BoundIntegration[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/user-automations/${userAutomationId}/integrations`);
      if (res.ok) {
        const data = await res.json();
        const reqs = (data.requirements ?? []) as IntegrationRequirement[];
        const bounds = (data.boundIntegrations ?? []) as BoundIntegration[];
        setRequirements(reqs);
        setBoundIntegrations(bounds);

        // Check if all required integrations are satisfied
        const allSatisfied = reqs.every((req) => {
          if (!req.required) return true;
          const bound = bounds.find((b) => b.role === req.id);
          return bound?.connection?.status === "CONNECTED";
        });
        onStatusChange?.(allSatisfied);
      }
    } catch {
      setErrorMessage("Failed to load integration status.");
    } finally {
      setLoading(false);
    }
  }, [userAutomationId, onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleDisconnect(connectionId: string) {
    if (!confirm("Are you sure you want to disconnect this account? The automation will not be able to execute until reconnected.")) {
      return;
    }

    try {
      setActionLoading(connectionId);
      setErrorMessage(null);

      const res = await fetch("/api/integrations/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect account.");
      }

      await fetchStatus();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Failed to disconnect account.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">Checking integration status...</span>
      </div>
    );
  }

  if (requirements.length === 0) {
    return null; // No external integrations required for this automation
  }

  return (
    <div className="bg-white dark:bg-surface-container-low border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-5 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Connected Integrations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            This automation executes actions through your connected personal accounts.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-container transition-colors"
          title="Refresh Status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        {requirements.map((req) => {
          const bound = boundIntegrations.find((b) => b.role === req.id);
          const connection = bound?.connection;
          const isConnected = connection?.status === "CONNECTED";
          const isExpired = connection?.status === "EXPIRED";
          const isError = connection?.status === "ERROR";

          return (
            <div
              key={req.id}
              className={`p-4 rounded-xl border transition-all ${
                isConnected
                  ? "bg-slate-50 dark:bg-surface-container border-slate-200 dark:border-white/10"
                  : isExpired || isError
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30"
                  : "bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-500/20"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white dark:bg-surface-container-high rounded-xl border border-slate-200 dark:border-white/10 shrink-0 mt-0.5">
                    <Mail className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {req.label}
                      </span>
                      {req.required && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-200 dark:bg-surface-container-high text-slate-700 dark:text-slate-300">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                      {req.description}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-medium text-slate-400">Permission:</span>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/60 dark:bg-surface-container-high text-slate-700 dark:text-slate-300">
                        {req.capability}
                      </span>
                    </div>

                    {/* Status Feedback */}
                    <div className="mt-2.5 flex items-center gap-2">
                      {isConnected ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Connected as: {connection?.accountEmail ?? "Active Account"}</span>
                        </div>
                      ) : isExpired ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Session expired. Reconnection required.</span>
                        </div>
                      ) : isError ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Connection error. Please reconnect.</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Not connected — automation cannot execute</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 sm:self-center">
                  {isConnected ? (
                    <button
                      id="disconnect-gmail-btn"
                      onClick={() => connection && handleDisconnect(connection.id)}
                      disabled={actionLoading === connection?.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === connection?.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      Disconnect
                    </button>
                  ) : isExpired || isError ? (
                    <button
                      type="button"
                      id="reconnect-gmail-btn"
                      onClick={() => setIsConnectModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reconnect Account
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="connect-gmail-btn"
                      onClick={() => setIsConnectModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:text-black text-white rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {req.id === "gmail" ? "Connect Gmail" : "Connect Account"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GmailConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        userAutomationId={userAutomationId}
        onSuccess={fetchStatus}
      />
    </div>
  );
}
