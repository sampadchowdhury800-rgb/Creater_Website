"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  createPlanAction,
  updatePlanAction,
  togglePlanStatusAction,
  deletePlanAction,
} from "./actions";

interface PlanItem {
  id: string;
  automationId: string;
  name: string;
  code: string;
  description: string | null;
  planType: "TRIAL" | "TIME_LIMITED" | "LIFETIME";
  price: number; // in paise
  originalPrice: number | null;
  currency: string;
  durationDays: number | null;
  trialDays: number | null;
  maintenanceEnabled: boolean;
  maintenancePrice: number; // in paise
  maintenanceInterval: "NONE" | "MONTHLY" | "YEARLY";
  maintenanceStartRule: "IMMEDIATELY" | "AFTER_ACCESS_EXPIRY";
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface Props {
  automation: {
    id: string;
    title: string;
    slug: string;
    price: number;
  };
  initialPlans: PlanItem[];
}

export default function PlansManagerClient({ automation, initialPlans }: Props) {
  const [plans, setPlans] = useState<PlanItem[]>(initialPlans);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    planType: "TIME_LIMITED" as "TRIAL" | "TIME_LIMITED" | "LIFETIME",
    priceRupees: 999,
    originalPriceRupees: "",
    durationDays: 30,
    trialDays: 7,
    maintenanceEnabled: false,
    maintenancePriceRupees: 299,
    maintenanceInterval: "MONTHLY" as "NONE" | "MONTHLY" | "YEARLY",
    maintenanceStartRule: "AFTER_ACCESS_EXPIRY" as "IMMEDIATELY" | "AFTER_ACCESS_EXPIRY",
    isPopular: false,
    isActive: true,
    sortOrder: 0,
  });

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      planType: "TIME_LIMITED",
      priceRupees: 999,
      originalPriceRupees: "",
      durationDays: 30,
      trialDays: 7,
      maintenanceEnabled: false,
      maintenancePriceRupees: 299,
      maintenanceInterval: "MONTHLY",
      maintenanceStartRule: "AFTER_ACCESS_EXPIRY",
      isPopular: false,
      isActive: true,
      sortOrder: plans.length * 10,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (plan: PlanItem) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description || "",
      planType: plan.planType,
      priceRupees: plan.price / 100,
      originalPriceRupees: plan.originalPrice ? String(plan.originalPrice / 100) : "",
      durationDays: plan.durationDays || 30,
      trialDays: plan.trialDays || 7,
      maintenanceEnabled: plan.maintenanceEnabled,
      maintenancePriceRupees: plan.maintenancePrice / 100,
      maintenanceInterval: plan.maintenanceInterval === "NONE" ? "MONTHLY" : plan.maintenanceInterval,
      maintenanceStartRule: plan.maintenanceStartRule,
      isPopular: plan.isPopular,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toLowerCase(),
        description: formData.description.trim() || null,
        planType: formData.planType,
        price: formData.planType === "TRIAL" ? 0 : Math.round(Number(formData.priceRupees) * 100),
        originalPrice: formData.originalPriceRupees ? Math.round(Number(formData.originalPriceRupees) * 100) : null,
        durationDays: formData.planType === "TIME_LIMITED" ? Number(formData.durationDays) : null,
        trialDays: formData.planType === "TRIAL" ? Number(formData.trialDays) : null,
        maintenanceEnabled: formData.maintenanceEnabled,
        maintenancePrice: formData.maintenanceEnabled ? Math.round(Number(formData.maintenancePriceRupees) * 100) : 0,
        maintenanceInterval: formData.maintenanceEnabled ? formData.maintenanceInterval : "NONE",
        maintenanceStartRule: formData.maintenanceStartRule,
        isPopular: formData.isPopular,
        isActive: formData.isActive,
        sortOrder: Number(formData.sortOrder) || 0,
      };

      if (editingPlan) {
        const res = await updatePlanAction(editingPlan.id, payload);
        if (!res.success) throw new Error(res.error);
        toast.success("Pricing plan updated successfully!");
        setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? (res.plan as any) : p)));
      } else {
        const res = await createPlanAction(automation.id, payload);
        if (!res.success) throw new Error(res.error);
        toast.success("New pricing plan created successfully!");
        setPlans((prev) => [...prev, res.plan as any]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (planId: string) => {
    try {
      const res = await togglePlanStatusAction(planId);
      if (!res.success) throw new Error(res.error);
      setPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, isActive: res.isActive as boolean } : p))
      );
      toast.success("Plan status updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status.");
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete or deactivate this plan?")) return;

    try {
      const res = await deletePlanAction(planId);
      if (!res.success) throw new Error(res.error);

      if (res.deactivated) {
        toast.info(res.message);
        setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, isActive: false } : p)));
      } else {
        toast.success("Plan deleted successfully.");
        setPlans((prev) => prev.filter((p) => p.id !== planId));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete plan.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0E10] text-white p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/automations/${automation.id}`}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-mono text-primary font-bold">
                  Commercial Configuration
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                  {plans.length} {plans.length === 1 ? "Plan" : "Plans"}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Pricing &amp; Plans: {automation.title}
              </h1>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-fixed text-black font-extrabold transition-all active:scale-95 shadow-[0_0_20px_rgba(0,219,238,0.2)] cursor-pointer"
          >
            <Plus size={18} />
            <span>Add Pricing Plan</span>
          </button>
        </div>

        {/* Plans List */}
        {plans.length === 0 ? (
          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-primary">
              <Zap size={32} />
            </div>
            <h3 className="text-xl font-bold">No Commercial Plans Defined Yet</h3>
            <p className="text-on-surface-variant max-w-md mx-auto text-sm">
              This automation will fall back to its legacy anchor price (₹{(automation.price / 100).toLocaleString()}).
              Create custom plans (e.g. Free Trial, 1 Month, 6 Months, or Lifetime) to offer customer options.
            </p>
            <button
              onClick={openCreateModal}
              className="px-6 py-2.5 bg-primary text-black font-extrabold rounded-xl hover:bg-primary-fixed transition-all cursor-pointer"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-[#1C1C1E] border rounded-2xl p-6 flex flex-col justify-between transition-all ${
                  plan.isActive ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-60"
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-primary text-black text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Sparkles size={12} />
                    Popular
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-primary">
                        {plan.planType}
                      </span>
                      <h3 className="text-xl font-bold text-white mt-2">{plan.name}</h3>
                      <p className="text-xs font-mono text-gray-500">code: {plan.code}</p>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(plan.id)}
                      title={plan.isActive ? "Click to deactivate" : "Click to activate"}
                      className="cursor-pointer"
                    >
                      {plan.isActive ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      ) : (
                        <XCircle size={20} className="text-gray-500" />
                      )}
                    </button>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 my-3">{plan.description}</p>
                  )}

                  {/* Price & Term Display */}
                  <div className="my-4 p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white">
                        {plan.planType === "TRIAL" ? "₹0 (Free)" : `₹${(plan.price / 100).toLocaleString()}`}
                      </span>
                      {plan.originalPrice && (
                        <span className="text-xs line-through text-gray-500">
                          ₹{(plan.originalPrice / 100).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
                      <Clock size={14} className="text-primary" />
                      {plan.planType === "LIFETIME" && <span>Lifetime / Perpetual Access</span>}
                      {plan.planType === "TIME_LIMITED" && (
                        <span>Valid for {plan.durationDays} days from purchase</span>
                      )}
                      {plan.planType === "TRIAL" && (
                        <span>One-time trial for {plan.trialDays} days</span>
                      )}
                    </div>
                  </div>

                  {/* Maintenance Disclosure */}
                  {plan.maintenanceEnabled ? (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                      <ShieldCheck size={16} />
                      <span>
                        +₹{(plan.maintenancePrice / 100).toLocaleString()}/mo recurring maintenance
                      </span>
                    </div>
                  ) : (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-white/5 text-xs text-gray-400">
                      No maintenance fees
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-mono">Order: {plan.sortOrder}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(plan)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                      title="Edit Plan"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                      title="Delete or Deactivate Plan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create / Edit Plan */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#1C1C1E] border border-white/15 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {editingPlan ? `Edit Plan: ${editingPlan.name}` : "Create New Pricing Plan"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 cursor-pointer"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Plan Type Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-400 mb-2">
                    Plan Category
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["TRIAL", "TIME_LIMITED", "LIFETIME"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            planType: type,
                            priceRupees: type === "TRIAL" ? 0 : prev.priceRupees || 999,
                            code: prev.code || (type === "TRIAL" ? "trial" : type === "LIFETIME" ? "lifetime" : "pass"),
                          }))
                        }
                        className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                          formData.planType === type
                            ? "bg-primary text-black border-primary font-extrabold"
                            : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {type === "TRIAL" ? "Free Trial" : type === "TIME_LIMITED" ? "Time-Limited" : "Lifetime Access"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 1 Month Pass, Pro License"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Internal Machine Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., 1m, 6m, lifetime, trial-7d"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Pricing Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Price (₹ INR) *
                    </label>
                    <input
                      type="number"
                      required
                      disabled={formData.planType === "TRIAL"}
                      min="0"
                      step="1"
                      value={formData.priceRupees}
                      onChange={(e) => setFormData({ ...formData, priceRupees: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white disabled:opacity-50 focus:outline-none focus:border-primary"
                    />
                    {formData.planType === "TRIAL" && (
                      <p className="text-[11px] text-gray-500 mt-1">Trial plans are strictly ₹0.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Original Price (Optional Strikethrough ₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g., 1499"
                      value={formData.originalPriceRupees}
                      onChange={(e) => setFormData({ ...formData, originalPriceRupees: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Duration Config based on Plan Type */}
                {formData.planType === "TIME_LIMITED" && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Access Duration (in Days) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      placeholder="e.g., 30, 90, 180, 365"
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {formData.planType === "TRIAL" && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                      Trial Duration (in Days) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      placeholder="e.g., 5, 7, 14"
                      value={formData.trialDays}
                      onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* Recurring Maintenance Section */}
                {formData.planType !== "TRIAL" && (
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">Enable Recurring Monthly Maintenance</h4>
                        <p className="text-xs text-gray-400">
                          Enables automated recurring maintenance billing via Razorpay Subscriptions.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.maintenanceEnabled}
                        onChange={(e) => setFormData({ ...formData, maintenanceEnabled: e.target.checked })}
                        className="w-5 h-5 accent-primary cursor-pointer"
                      />
                    </div>

                    {formData.maintenanceEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                            Maintenance Fee (₹ / month) *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={formData.maintenancePriceRupees}
                            onChange={(e) =>
                              setFormData({ ...formData, maintenancePriceRupees: Number(e.target.value) })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                            Maintenance Interval
                          </label>
                          <select
                            value={formData.maintenanceInterval}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maintenanceInterval: e.target.value as "MONTHLY" | "YEARLY",
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none [&>option]:bg-[#1C1C1E]"
                          >
                            <option value="MONTHLY">Monthly</option>
                            <option value="YEARLY">Yearly</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                    Plan Highlights / Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Includes full workflow executions, email support, and free updates."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Toggles: Popular, Active, Sort Order */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/5">
                    <input
                      type="checkbox"
                      checked={formData.isPopular}
                      onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    <span className="text-xs font-medium">Mark as Popular</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/5 border border-white/5">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    <span className="text-xs font-medium">Active &amp; Visible</span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">
                      Display Sort Order
                    </label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-black font-extrabold text-sm hover:bg-primary-fixed disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    <span>{editingPlan ? "Update Plan" : "Create Plan"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
