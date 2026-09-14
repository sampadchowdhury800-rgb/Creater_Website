"use client";

import { useState } from "react";
import type { ConfigSchema, ConfigSchemaField } from "@/lib/automation/validation";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
  Info,
} from "lucide-react";

interface AutomationInterfaceRendererProps {
  /**
   * The configSchema from the Automation record.
   * Loaded server-side — not supplied by the browser.
   */
  configSchema: ConfigSchema | null | undefined;

  /**
   * The current saved user configuration values from UserAutomation.config.
   */
  currentConfig: Record<string, unknown> | null | undefined;

  /**
   * Called when the user submits the configuration form.
   * The values object is keyed by field.key and contains user input.
   * Server-side validation happens before any execution — this is a UI convenience callback.
   */
  onSave?: (values: Record<string, unknown>) => Promise<void>;

  /**
   * If true, the form is in read-only display mode.
   */
  readOnly?: boolean;

  /**
   * If true, show a saving/loading state on the submit button.
   */
  saving?: boolean;
}

/**
 * AutomationInterfaceRenderer
 *
 * Renders a dynamic user configuration form based on an Automation's configSchema.
 *
 * ARCHITECTURE:
 * - Does NOT hardcode any automation-specific logic.
 * - Does NOT perform client-side-only validation as source of truth.
 *   (Server validates against the same schema before execution.)
 * - Each field type is rendered by a dedicated sub-component.
 * - Future automation interfaces are added by defining a configSchema in the Admin,
 *   NOT by editing this component.
 *
 * SUPPORTED FIELD TYPES (from ConfigFieldType):
 *   text, email, textarea, number, select, multiselect, checkbox, toggle, url, date
 */
export function AutomationInterfaceRenderer({
  configSchema,
  currentConfig,
  onSave,
  readOnly = false,
  saving = false,
}: AutomationInterfaceRendererProps) {
  // Initialize form values from currentConfig, falling back to field defaultValues.
  // SECURITY: Sensitive fields that are already configured get an empty string in
  // the form state — we never pre-fill a secret value in the UI.
  // On submit, if the field is still empty, the "__KEEP_EXISTING__" sentinel tells
  // the server action to preserve the existing encrypted secret without overwriting.
  const initValues = (): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    if (!configSchema?.fields) return values;
    for (const field of configSchema.fields) {
      const saved = currentConfig?.[field.key];
      if (field.sensitive) {
        // Never pre-fill sensitive fields — always start empty in the form.
        // The server will keep the existing secret if this remains blank on save.
        values[field.key] = "";
      } else {
        values[field.key] =
          saved !== undefined && saved !== null ? saved : field.defaultValue ?? "";
      }
    }
    return values;
  };

  const [values, setValues] = useState<Record<string, unknown>>(initValues);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});

  if (!configSchema || !configSchema.fields || configSchema.fields.length === 0) {
    return (
      <div className="py-10 text-center text-slate-400 text-sm">
        <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p>This automation does not require any configuration.</p>
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error on change
    if (clientErrors[key]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSave || readOnly) return;

    // Client-side required field check (convenience only — server validates authoritatively)
    const errors: Record<string, string> = {};
    for (const field of configSchema.fields) {
      if (field.required) {
        const val = values[field.key];
        const isEmpty =
          val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);

        if (field.sensitive) {
          // For sensitive fields: required is only violated if there's ALSO no existing secret.
          // If the field is empty in the form but a secret is already configured, that's OK —
          // the server will keep the existing one.
          const savedVal = currentConfig?.[field.key];
          const isAlreadyConfigured =
            savedVal !== undefined &&
            savedVal !== null &&
            typeof savedVal === "object" &&
            (savedVal as Record<string, unknown>).__isSecret === true &&
            (savedVal as Record<string, unknown>).configured === true;

          if (isEmpty && !isAlreadyConfigured) {
            errors[field.key] = `${field.label ?? field.key} is required.`;
          }
        } else {
          if (isEmpty) {
            errors[field.key] = `${field.label ?? field.key} is required.`;
          }
        }
      }
    }
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    // Build submit values: for sensitive fields that are empty, send the sentinel
    // so the server knows to keep the existing encrypted secret.
    const submitValues: Record<string, unknown> = {};
    for (const field of configSchema.fields) {
      const val = values[field.key];
      if (
        field.sensitive &&
        (val === undefined || val === null || val === "")
      ) {
        submitValues[field.key] = "__KEEP_EXISTING__";
      } else {
        submitValues[field.key] = val;
      }
    }

    await onSave(submitValues);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {configSchema.fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          error={clientErrors[field.key]}
          readOnly={readOnly}
          showSensitive={!!showSensitive[field.key]}
          onToggleSensitive={() =>
            setShowSensitive((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
          }
          onChange={(val) => handleChange(field.key, val)}
          savedSecretConfig={field.sensitive ? currentConfig?.[field.key] : undefined}
        />
      ))}

      {!readOnly && onSave && (
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      )}
    </form>
  );
}

// ─── Field Renderer ────────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: ConfigSchemaField;
  value: unknown;
  error?: string;
  readOnly: boolean;
  showSensitive: boolean;
  onToggleSensitive: () => void;
  onChange: (value: unknown) => void;
  /**
   * For sensitive fields: the raw value from UserAutomation.config.
   * If this is a secret placeholder object ({ __isSecret: true, configured: true }),
   * the field shows a "✓ Configured" badge and a keep-existing placeholder.
   */
  savedSecretConfig?: unknown;
}

function FieldRenderer({
  field,
  value,
  error,
  readOnly,
  showSensitive,
  onToggleSensitive,
  onChange,
  savedSecretConfig,
}: FieldRendererProps) {
  const baseInputClass =
    "w-full bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-cyan-500/50 focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-50 dark:disabled:bg-surface-container-low disabled:text-slate-500 dark:disabled:text-slate-400";
  const errorClass = error ? "border-red-300 ring-1 ring-red-300" : "";

  const fieldId = `field-${field.key}`;

  // Determine if a secret is already configured (server-stored encrypted value)
  const isSecretConfigured =
    field.sensitive &&
    savedSecretConfig !== undefined &&
    savedSecretConfig !== null &&
    typeof savedSecretConfig === "object" &&
    (savedSecretConfig as Record<string, unknown>).__isSecret === true &&
    (savedSecretConfig as Record<string, unknown>).configured === true;

  const sensitivePlaceholder = isSecretConfigured
    ? "Leave blank to keep existing, or paste new secret to replace"
    : (field.placeholder ?? "Enter sensitive value...");

  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "url":
        return (
          <div className="relative">
            <input
              id={fieldId}
              type={
                field.type === "email" ? "email" : field.type === "url" ? "url" : "text"
              }
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              minLength={field.minLength}
              maxLength={field.maxLength}
              disabled={readOnly}
              className={`${baseInputClass} ${errorClass}`}
            />
          </div>
        );

      case "number":
        return (
          <input
            id={fieldId}
            type="number"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.valueAsNumber || e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={readOnly}
            className={`${baseInputClass} ${errorClass}`}
          />
        );

      case "textarea":
        return (
          <textarea
            id={fieldId}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            minLength={field.minLength}
            maxLength={field.maxLength}
            disabled={readOnly}
            rows={4}
            className={`${baseInputClass} ${errorClass} resize-y`}
          />
        );

      case "select":
        return (
          <div className="relative">
            <select
              id={fieldId}
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              className={`${baseInputClass} ${errorClass} appearance-none pr-10`}
            >
              <option value="">
                {field.placeholder ?? `Select ${field.label ?? field.key}...`}
              </option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        );

      case "multiselect":
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((opt) => {
              const selected = Array.isArray(value)
                ? (value as string[]).includes(opt.value)
                : false;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    const current = Array.isArray(value) ? (value as string[]) : [];
                    onChange(
                      selected
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value]
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    selected
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-3">
            <input
              id={fieldId}
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={readOnly}
              className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
            />
            <label htmlFor={fieldId} className="text-sm text-slate-700 cursor-pointer">
              {field.placeholder ?? field.label}
            </label>
          </div>
        );

      case "toggle":
        return (
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            disabled={readOnly}
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 ${
              value ? "bg-slate-900" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        );

      case "date":
        return (
          <input
            id={fieldId}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className={`${baseInputClass} ${errorClass}`}
          />
        );

      default:
        return (
          <input
            id={fieldId}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
            className={`${baseInputClass} ${errorClass}`}
          />
        );
    }
  };

  // Sensitive field: mask/unmask support
  const isSensitiveText =
    field.sensitive && (field.type === "text" || field.type === "email" || field.type === "url");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={fieldId}
          className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"
        >
          {field.label ?? field.key}
          {field.required && (
            <span className="text-red-500 text-xs font-bold" aria-label="required">
              *
            </span>
          )}
          {field.sensitive && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
              Sensitive
            </span>
          )}
          {isSecretConfigured && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-0.5">
              <span aria-hidden="true">✓</span> Configured
            </span>
          )}
        </label>
        {isSensitiveText && (
          <button
            type="button"
            onClick={onToggleSensitive}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
          >
            {showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showSensitive ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {/* Override input type for sensitive masking */}
      {isSensitiveText ? (
        <div className="relative">
          <input
            id={fieldId}
            type={showSensitive ? "text" : "password"}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={sensitivePlaceholder}
            minLength={field.minLength}
            maxLength={field.maxLength}
            disabled={readOnly}
            autoComplete="off"
            className={`${baseInputClass} ${errorClass} pr-10`}
          />
        </div>
      ) : (
        renderInput()
      )}

      {field.helpText && !error && (
        <p className="text-xs text-slate-500 leading-relaxed">{field.helpText}</p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
