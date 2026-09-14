"use client";

import { useState } from "react";
import { Plus, Trash2, Mail, ShieldAlert } from "lucide-react";
import type { IntegrationRequirement, AutomationIntegrationRequirements } from "@/lib/integrations/types";

const CAPABILITY_OPTIONS = [
  { value: "GMAIL_SEND", label: "Gmail Send (gmail.send)", desc: "Send automated emails on behalf of the customer." },
  { value: "GMAIL_READ_LIST", label: "Gmail Read & List (gmail.readonly)", desc: "List messages and threads in customer inbox." },
  { value: "GMAIL_GET_MESSAGE", label: "Gmail Get Message (gmail.readonly)", desc: "Retrieve specific message content." },
  { value: "GMAIL_MODIFY", label: "Gmail Modify (gmail.modify)", desc: "Apply labels or trash messages." },
] as const;

interface Props {
  value: AutomationIntegrationRequirements | null | undefined;
  onChange: (value: AutomationIntegrationRequirements) => void;
}

export function IntegrationRequirementsEditor({ value, onChange }: Props) {
  const requirements: IntegrationRequirement[] = value?.requirements ?? [];

  const updateRequirements = (newReqs: IntegrationRequirement[]) => {
    onChange({ requirements: newReqs });
  };

  const handleAdd = () => {
    const newReq: IntegrationRequirement = {
      id: `gmail_${requirements.length + 1}`,
      provider: "GOOGLE",
      capability: "GMAIL_SEND",
      required: true,
      label: "Gmail Account",
      description: "Required to perform automated actions directly from your personal Gmail account.",
    };
    updateRequirements([...requirements, newReq]);
  };

  const handleApplyPreset = () => {
    const gmailPreset: IntegrationRequirement = {
      id: "gmail",
      provider: "GOOGLE",
      capability: "GMAIL_SEND",
      required: true,
      label: "Gmail Account for Auto-Replies",
      description: "Used to send instant automated email responses directly from your Gmail account.",
    };
    // Don't add duplicate id
    const filtered = requirements.filter((r) => r.id !== "gmail");
    updateRequirements([...filtered, gmailPreset]);
  };

  const handleRemove = (index: number) => {
    const updated = requirements.filter((_, i) => i !== index);
    updateRequirements(updated);
  };

  const handleChange = (index: number, field: keyof IntegrationRequirement, val: unknown) => {
    const updated = [...requirements];
    updated[index] = {
      ...updated[index],
      [field]: val,
    };
    updateRequirements(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Customer OAuth Integration Requirements
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Declare which third-party connections customers must bind in their workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApplyPreset}
            className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors cursor-pointer"
          >
            + Auto-Reply Preset
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary-container hover:bg-primary text-black rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Requirement
          </button>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Security Invariant:</span> Raw OAuth scopes cannot be declared here.
          Scopes are strictly derived on the server from the selected immutable capability registry.
        </div>
      </div>

      {requirements.length === 0 ? (
        <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-xs text-on-surface-variant">
          No external OAuth integrations required for this product. Click above to require a customer Google/Gmail connection.
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((req, idx) => (
            <div
              key={idx}
              className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Integration Requirement #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                  title="Remove requirement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Provider
                  </label>
                  <select
                    value={req.provider}
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white opacity-80 cursor-not-allowed"
                  >
                    <option value="GOOGLE">Google Workspace / Gmail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Allowed Capability
                  </label>
                  <select
                    value={req.capability}
                    onChange={(e) => handleChange(idx, "capability", e.target.value)}
                    className="w-full bg-[#2C2C2E] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {CAPABILITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Internal Role ID (Alphanumeric/underscore)
                  </label>
                  <input
                    type="text"
                    value={req.id}
                    onChange={(e) => handleChange(idx, "id", e.target.value.trim())}
                    placeholder="e.g. gmail"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Customer UI Label
                  </label>
                  <input
                    type="text"
                    value={req.label}
                    onChange={(e) => handleChange(idx, "label", e.target.value)}
                    placeholder="e.g. Gmail Account for Auto-Replies"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                  Customer Description / Explanation
                </label>
                <input
                  type="text"
                  value={req.description}
                  onChange={(e) => handleChange(idx, "description", e.target.value)}
                  placeholder="e.g. Used to send instant automated email responses directly from your Gmail account."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`req_required_${idx}`}
                  checked={req.required}
                  onChange={(e) => handleChange(idx, "required", e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor={`req_required_${idx}`}
                  className="text-xs text-on-surface-variant select-none cursor-pointer"
                >
                  Strictly required before execution is permitted
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
