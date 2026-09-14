"use client";

import React, { useState } from "react";
import type {
  ConfigSchema,
  ConfigSchemaField,
  ConfigFieldType,
  ConfigFieldOption,
} from "@/lib/automation/validation";
import { VALID_CONFIG_FIELD_TYPES } from "@/lib/automation/validation";
import { AutomationInterfaceRenderer } from "@/components/automations/AutomationInterfaceRenderer";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Sliders,
  Eye,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";

interface ConfigSchemaEditorProps {
  value: ConfigSchema;
  onChange: (schema: ConfigSchema) => void;
}

// Helper to convert a label into a clean machine-readable camelCase identifier key
function slugifyKey(label: string): string {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9\s_]/g, "")
    .split(/[\s_]+/)
    .filter(Boolean);

  if (words.length === 0) return "";
  const first = words[0].toLowerCase();
  const rest = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `${first}${rest.join("")}`;
}

const FIELD_TYPE_LABELS: Record<ConfigFieldType, { label: string; badgeColor: string }> = {
  text: { label: "Single-line Text", badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  email: { label: "Email Address", badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  textarea: { label: "Multi-line Text Area", badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
  number: { label: "Number", badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  select: { label: "Dropdown Select", badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  multiselect: { label: "Multi-select Chips", badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  checkbox: { label: "Checkbox", badgeColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  toggle: { label: "Toggle Switch", badgeColor: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  url: { label: "URL Link", badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  date: { label: "Date Picker", badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

export function ConfigSchemaEditor({ value, onChange }: ConfigSchemaEditorProps) {
  const fields = value?.fields ?? [];
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");
  const [expandedFieldKeys, setExpandedFieldKeys] = useState<Record<string, boolean>>({});
  const [manuallyEditedKeys, setManuallyEditedKeys] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedFieldKeys((prev) => ({
      ...prev,
      [idx]: prev[idx] !== undefined ? !prev[idx] : false, // default was expanded
    }));
  };

  const isExpanded = (idx: number) => {
    return expandedFieldKeys[idx] !== false; // expanded by default
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    fields.forEach((_, i) => (next[i] = true));
    setExpandedFieldKeys(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    fields.forEach((_, i) => (next[i] = false));
    setExpandedFieldKeys(next);
  };

  const addField = () => {
    const baseKey = `field_${fields.length + 1}`;
    let uniqueKey = baseKey;
    let counter = 1;
    while (fields.some((f) => f.key.toLowerCase() === uniqueKey.toLowerCase())) {
      counter++;
      uniqueKey = `field_${fields.length + counter}`;
    }

    const newField: ConfigSchemaField = {
      key: uniqueKey,
      label: `Field ${fields.length + 1}`,
      type: "text",
      required: false,
      placeholder: "",
      helpText: "",
    };

    const nextFields = [...fields, newField];
    onChange({ fields: nextFields });

    // Expand newly added field
    setExpandedFieldKeys((prev) => ({ ...prev, [nextFields.length - 1]: true }));
  };

  const updateField = (index: number, updates: Partial<ConfigSchemaField>) => {
    const nextFields = fields.map((f, i) => (i === index ? { ...f, ...updates } : f));
    onChange({ fields: nextFields });
  };

  const removeField = (index: number) => {
    const nextFields = fields.filter((_, i) => i !== index);
    onChange({ fields: nextFields });
  };

  const duplicateField = (index: number) => {
    const target = fields[index];
    let newKey = `${target.key}_copy`;
    let counter = 1;
    while (fields.some((f) => f.key.toLowerCase() === newKey.toLowerCase())) {
      counter++;
      newKey = `${target.key}_copy${counter}`;
    }

    const duplicated: ConfigSchemaField = {
      ...JSON.parse(JSON.stringify(target)),
      key: newKey,
      label: `${target.label} (Copy)`,
    };

    const nextFields = [
      ...fields.slice(0, index + 1),
      duplicated,
      ...fields.slice(index + 1),
    ];
    onChange({ fields: nextFields });
    setExpandedFieldKeys((prev) => ({ ...prev, [index + 1]: true }));
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= fields.length) return;
    const nextFields = [...fields];
    const [moved] = nextFields.splice(fromIndex, 1);
    nextFields.splice(toIndex, 0, moved);
    onChange({ fields: nextFields });

    // Swap expansion states
    setExpandedFieldKeys((prev) => {
      const copy = { ...prev };
      const fromState = copy[fromIndex];
      copy[fromIndex] = copy[toIndex];
      copy[toIndex] = fromState;
      return copy;
    });
  };

  // Check duplicate keys for inline error styling
  const keyCounts: Record<string, number> = {};
  fields.forEach((f) => {
    const k = f.key?.trim().toLowerCase() || "";
    if (k) keyCounts[k] = (keyCounts[k] || 0) + 1;
  });

  return (
    <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Sliders className="w-5 h-5 text-primary-fixed-dim" />
            <h2 className="text-lg font-bold text-white">User Configuration Interface</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-white/10 text-on-surface-variant">
              {fields.length} {fields.length === 1 ? "field" : "fields"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
            Visually design the configuration form your buyers fill out inside their workspace before running this automation.
            If this product requires no customer input, leave this section empty.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("builder")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "builder"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Builder</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "preview"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>User Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: BUILDER */}
      {activeTab === "builder" && (
        <div className="space-y-4">
          {fields.length > 0 && (
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-white transition-colors"
                >
                  Expand All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-white transition-colors"
                >
                  Collapse All
                </button>
              </div>
              <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container hover:bg-primary-fixed text-on-primary-container rounded-lg font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>
          )}

          {fields.length === 0 ? (
            <div className="py-12 px-4 border border-dashed border-white/10 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Configuration Fields Defined</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                This automation currently requires no customer configuration. Customers will be able to execute or download it immediately without filling in form inputs.
              </p>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold rounded-xl transition-colors mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Configuration Field</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, idx) => {
                const expanded = isExpanded(idx);
                const hasDuplicateKey = (keyCounts[field.key?.trim().toLowerCase()] || 0) > 1;
                const isKeyInvalid = !field.key || !/^[a-zA-Z0-9_]+$/.test(field.key);
                const typeMeta = FIELD_TYPE_LABELS[field.type] || FIELD_TYPE_LABELS.text;

                return (
                  <div
                    key={idx}
                    className={`border rounded-xl transition-all ${
                      hasDuplicateKey || isKeyInvalid
                        ? "border-red-500/50 bg-red-950/10"
                        : "border-white/10 bg-[#161618]"
                    }`}
                  >
                    {/* Field Header / Summary Bar */}
                    <div className="p-3.5 flex items-center justify-between gap-3 select-none">
                      <div
                        onClick={() => toggleExpand(idx)}
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      >
                        <span className="text-[11px] font-mono font-bold text-on-surface-variant px-1.5 py-0.5 bg-white/5 rounded border border-white/10 shrink-0">
                          #{idx + 1}
                        </span>

                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${typeMeta.badgeColor}`}
                        >
                          {typeMeta.label}
                        </span>

                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm font-semibold text-white truncate">
                            {field.label || "Untitled Field"}
                          </span>
                          <span className="text-xs font-mono text-on-surface-variant truncate">
                            ({field.key || "no-key"})
                          </span>
                        </div>

                        {field.required && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded shrink-0">
                            Required
                          </span>
                        )}

                        {field.sensitive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded shrink-0">
                            Sensitive
                          </span>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveField(idx, idx - 1)}
                          title="Move up"
                          className="p-1.5 text-on-surface-variant hover:text-white disabled:opacity-30 disabled:hover:text-on-surface-variant transition-colors rounded-lg hover:bg-white/5"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === fields.length - 1}
                          onClick={() => moveField(idx, idx + 1)}
                          title="Move down"
                          className="p-1.5 text-on-surface-variant hover:text-white disabled:opacity-30 disabled:hover:text-on-surface-variant transition-colors rounded-lg hover:bg-white/5"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateField(idx)}
                          title="Duplicate field"
                          className="p-1.5 text-on-surface-variant hover:text-white transition-colors rounded-lg hover:bg-white/5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          title="Delete field"
                          className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors rounded-lg hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          title={expanded ? "Collapse" : "Expand"}
                          className="p-1.5 text-on-surface-variant hover:text-white transition-colors rounded-lg hover:bg-white/5 ml-1"
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Field Edit Body */}
                    {expanded && (
                      <div className="p-4 border-t border-white/5 space-y-4 bg-[#18181A]">
                        {/* Row 1: Label, Key, Type */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Field Label <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={field.label}
                              onChange={(e) => {
                                const newLabel = e.target.value;
                                const updates: Partial<ConfigSchemaField> = { label: newLabel };
                                // Auto-slugify key only if user hasn't manually edited key
                                if (!manuallyEditedKeys[idx]) {
                                  updates.key = slugifyKey(newLabel) || field.key;
                                }
                                updateField(idx, updates);
                              }}
                              placeholder="e.g. Google Account Email"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-fixed-dim"
                            />
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              User-facing label shown above the input
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Machine Key <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={field.key}
                              onChange={(e) => {
                                setManuallyEditedKeys((prev) => ({ ...prev, [idx]: true }));
                                updateField(idx, { key: e.target.value.trim() });
                              }}
                              placeholder="e.g. googleAccountEmail"
                              className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none ${
                                hasDuplicateKey || isKeyInvalid
                                  ? "border-red-500 focus:border-red-400"
                                  : "border-white/10 focus:border-primary-fixed-dim"
                              }`}
                            />
                            {hasDuplicateKey ? (
                              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Key must be unique in this schema
                              </p>
                            ) : isKeyInvalid ? (
                              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Letters, numbers, and underscores only
                              </p>
                            ) : (
                              <p className="text-[11px] text-on-surface-variant mt-1">
                                Unique variable key passed to n8n execution
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Field Type
                            </label>
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const newType = e.target.value as ConfigFieldType;
                                const updates: Partial<ConfigSchemaField> = { type: newType };
                                if ((newType === "select" || newType === "multiselect") && !field.options) {
                                  updates.options = [
                                    { label: "Option 1", value: "option_1" },
                                    { label: "Option 2", value: "option_2" },
                                  ];
                                }
                                updateField(idx, updates);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-fixed-dim [&>option]:bg-[#1C1C1E]"
                            >
                              {VALID_CONFIG_FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {FIELD_TYPE_LABELS[t]?.label ?? t}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Determines input UI and server-side validation
                            </p>
                          </div>
                        </div>

                        {/* Row 2: Placeholder, Help Text, Default Value */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Placeholder (Optional)
                            </label>
                            <input
                              type="text"
                              value={field.placeholder || ""}
                              onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                              placeholder="e.g. user@example.com"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-fixed-dim"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Help Text / Description (Optional)
                            </label>
                            <input
                              type="text"
                              value={field.helpText || ""}
                              onChange={(e) => updateField(idx, { helpText: e.target.value })}
                              placeholder="e.g. Enter your Gmail login address"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-fixed-dim"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-white mb-1.5">
                              Default Value (Optional)
                            </label>
                            <input
                              type="text"
                              value={String(field.defaultValue ?? "")}
                              onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                              placeholder="e.g. Default text or number"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-fixed-dim"
                            />
                          </div>
                        </div>

                        {/* Row 3: Flags (Required, Sensitive) */}
                        <div className="flex flex-wrap items-center gap-6 pt-1 border-t border-white/5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(idx, { required: e.target.checked })}
                              className="w-4 h-4 accent-primary rounded cursor-pointer"
                            />
                            <span className="text-xs font-medium text-white">
                              Required field (user must provide before execution)
                            </span>
                          </label>

                          {(field.type === "text" || field.type === "email" || field.type === "url") && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!field.sensitive}
                                onChange={(e) => updateField(idx, { sensitive: e.target.checked })}
                                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                              />
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-amber-300">
                                  Sensitive (mask input with dots)
                                </span>
                                <span
                                  title="Masks input with dots and shows an eye toggle. NOTE: Stored as plaintext JSON in DB pending vault encryption."
                                  className="text-on-surface-variant hover:text-white"
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </label>
                          )}
                        </div>

                        {/* TYPE SPECIFIC: Select / Multiselect Options Editor */}
                        {(field.type === "select" || field.type === "multiselect") && (
                          <div className="pt-3 border-t border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                                Dropdown Options ({field.options?.length ?? 0})
                                <span className="text-rose-400">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentOptions = field.options || [];
                                  const nextOption: ConfigFieldOption = {
                                    label: `Option ${currentOptions.length + 1}`,
                                    value: `option_${currentOptions.length + 1}`,
                                  };
                                  updateField(idx, { options: [...currentOptions, nextOption] });
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-white/10 hover:bg-white/15 text-white rounded-md transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Option</span>
                              </button>
                            </div>

                            {(!field.options || field.options.length === 0) ? (
                              <p className="text-xs text-rose-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                At least one option is required for dropdown fields.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {field.options.map((opt, optIdx) => (
                                  <div
                                    key={optIdx}
                                    className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl"
                                  >
                                    <span className="text-[11px] font-mono text-on-surface-variant w-5 text-center shrink-0">
                                      {optIdx + 1}.
                                    </span>
                                    <input
                                      type="text"
                                      value={opt.label}
                                      onChange={(e) => {
                                        const newLabel = e.target.value;
                                        const nextOpts = [...(field.options || [])];
                                        nextOpts[optIdx] = {
                                          ...opt,
                                          label: newLabel,
                                          // auto-value if untouched
                                          value: opt.value.startsWith("option_")
                                            ? slugifyKey(newLabel) || opt.value
                                            : opt.value,
                                        };
                                        updateField(idx, { options: nextOpts });
                                      }}
                                      placeholder="Option Display Label"
                                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                                    />
                                    <input
                                      type="text"
                                      value={opt.value}
                                      onChange={(e) => {
                                        const nextOpts = [...(field.options || [])];
                                        nextOpts[optIdx] = { ...opt, value: e.target.value.trim() };
                                        updateField(idx, { options: nextOpts });
                                      }}
                                      placeholder="Value (key)"
                                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-primary-fixed-dim"
                                    />
                                    <button
                                      type="button"
                                      disabled={(field.options?.length || 0) <= 1}
                                      onClick={() => {
                                        const nextOpts = (field.options || []).filter((_, i) => i !== optIdx);
                                        updateField(idx, { options: nextOpts });
                                      }}
                                      title="Remove option"
                                      className="p-1.5 text-rose-400 hover:text-rose-300 disabled:opacity-30 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* TYPE SPECIFIC: Number Min / Max / Step */}
                        {field.type === "number" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/5">
                            <div>
                              <label className="block text-xs font-semibold text-white mb-1">
                                Minimum Value
                              </label>
                              <input
                                type="number"
                                value={field.min ?? ""}
                                onChange={(e) =>
                                  updateField(idx, {
                                    min: e.target.value !== "" ? Number(e.target.value) : undefined,
                                  })
                                }
                                placeholder="No minimum"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-white mb-1">
                                Maximum Value
                              </label>
                              <input
                                type="number"
                                value={field.max ?? ""}
                                onChange={(e) =>
                                  updateField(idx, {
                                    max: e.target.value !== "" ? Number(e.target.value) : undefined,
                                  })
                                }
                                placeholder="No maximum"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-white mb-1">
                                Step Increment
                              </label>
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={field.step ?? ""}
                                onChange={(e) =>
                                  updateField(idx, {
                                    step: e.target.value !== "" ? Number(e.target.value) : undefined,
                                  })
                                }
                                placeholder="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                              />
                            </div>
                          </div>
                        )}

                        {/* TYPE SPECIFIC: Text Length Bounds */}
                        {(field.type === "text" || field.type === "textarea") && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/5">
                            <div>
                              <label className="block text-xs font-semibold text-white mb-1">
                                Minimum Characters
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={field.minLength ?? ""}
                                onChange={(e) =>
                                  updateField(idx, {
                                    minLength: e.target.value !== "" ? Number(e.target.value) : undefined,
                                  })
                                }
                                placeholder="e.g. 3"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-white mb-1">
                                Maximum Characters
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={field.maxLength ?? ""}
                                onChange={(e) =>
                                  updateField(idx, {
                                    maxLength: e.target.value !== "" ? Number(e.target.value) : undefined,
                                  })
                                }
                                placeholder="e.g. 500"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-fixed-dim"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={addField}
                  className="w-full py-3 border border-dashed border-white/15 hover:border-primary-fixed-dim rounded-xl text-xs font-bold text-on-surface-variant hover:text-white flex items-center justify-center gap-2 transition-all hover:bg-white/5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Field</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE USER PREVIEW */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3 text-blue-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Live Workspace Simulation</p>
              <p className="text-blue-300/80 mt-0.5">
                This interactive preview uses the exact same <code className="font-mono bg-blue-950 px-1 py-0.5 rounded text-[11px]">AutomationInterfaceRenderer</code> component that buyers see in their <code className="font-mono bg-blue-950 px-1 py-0.5 rounded text-[11px]">/my-automations/[id]</code> workspace. You can type in the inputs and test validations in real time.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-base text-slate-900">Automation Configuration</h3>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md font-semibold">
                Customer View
              </span>
            </div>

            <AutomationInterfaceRenderer
              configSchema={{ fields }}
              currentConfig={{}}
              readOnly={false}
              onSave={async () => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
