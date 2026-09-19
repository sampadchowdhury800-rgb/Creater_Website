"use client";

import React, { useState, useEffect, useRef } from "react";
import { GripVertical, Plus, Trash2, Link as LinkIcon, Type, FolderOpen } from "lucide-react";
import type { PromptSection, PromptItem, PostContent } from "@/lib/postTypes";

interface PromptEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// ── Pure parse helper (module scope, no hooks) ────────────────────────────────

function parseContent(raw: string): PostContent {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PostContent;
  } catch {
    return {};
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PromptEditor({ content, onChange }: PromptEditorProps) {
  // Parse meta data to preserve it across updates
  const [parsedMeta, setParsedMeta] = useState<Omit<PostContent, "toolLinks" | "promptSections">>(() => {
    const { toolLinks: _tl, promptSections: _ps, ...rest } = parseContent(content);
    return rest;
  });

  const [sections, setSections] = useState<PromptSection[]>(() => {
    const parsed = parseContent(content);
    let initial = parsed.promptSections ?? [];
    if (initial.length === 0 && parsed.toolLinks && parsed.toolLinks.length > 0) {
      initial = [
        {
          id: generateId(),
          sectionTitle: "AI Prompts",
          items: parsed.toolLinks,
        }
      ];
    }
    return initial;
  });

  // Track dragging state
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ sectionIndex: number; itemIndex: number } | null>(null);

  // Track mount state for resetting
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // Only re-initialise when the parent clears content (e.g. "new post" reset)
    if (!content) {
      setParsedMeta({});
      setSections([]);
    }
  }, [content]);

  // ── Serialise & propagate ────────────────────────────────────────────────────

  const commitSections = (newSections: PromptSection[]) => {
    setSections(newSections);
    const next: PostContent = { ...parsedMeta, promptSections: newSections };
    onChange(JSON.stringify(next, null, 2));
  };

  // ── Section CRUD ─────────────────────────────────────────────────────────────

  const addSection = () => {
    commitSections([
      ...sections,
      {
        id: generateId(),
        sectionTitle: "New Section",
        items: [{ label: "", url: "", websiteLabel: "", websiteUrl: "" }],
      },
    ]);
  };

  const updateSectionTitle = (sIndex: number, title: string) => {
    const next = [...sections];
    next[sIndex] = { ...next[sIndex], sectionTitle: title };
    commitSections(next);
  };

  const deleteSection = (sIndex: number) => {
    if (confirm("Are you sure you want to delete this entire section?")) {
      commitSections(sections.filter((_, i) => i !== sIndex));
    }
  };

  // ── Item CRUD ────────────────────────────────────────────────────────────────

  const addItem = (sIndex: number) => {
    const next = [...sections];
    next[sIndex] = {
      ...next[sIndex],
      items: [...next[sIndex].items, { label: "", url: "", websiteLabel: "", websiteUrl: "" }],
    };
    commitSections(next);
  };

  const updateItem = (sIndex: number, iIndex: number, field: keyof PromptItem, value: string) => {
    const next = [...sections];
    const items = [...next[sIndex].items];
    items[iIndex] = { ...items[iIndex], [field]: value };
    next[sIndex] = { ...next[sIndex], items };
    commitSections(next);
  };

  const deleteItem = (sIndex: number, iIndex: number) => {
    const next = [...sections];
    next[sIndex] = {
      ...next[sIndex],
      items: next[sIndex].items.filter((_, i) => i !== iIndex),
    };
    commitSections(next);
  };

  // ── Section Drag & Drop ──────────────────────────────────────────────────────

  const handleSectionDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    // Only drag section if not dragging an item
    if (draggedItem !== null) return;
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSectionDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedSectionIndex === null || draggedSectionIndex === index) return;
    const next = [...sections];
    const [dragged] = next.splice(draggedSectionIndex, 1);
    next.splice(index, 0, dragged);
    setSections(next);
    setDraggedSectionIndex(index);
  };

  const handleSectionDragEnd = () => {
    setDraggedSectionIndex(null);
    commitSections(sections);
  };

  // ── Item Drag & Drop ─────────────────────────────────────────────────────────

  const handleItemDragStart = (e: React.DragEvent<HTMLDivElement>, sIndex: number, iIndex: number) => {
    e.stopPropagation();
    setDraggedItem({ sectionIndex: sIndex, itemIndex: iIndex });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: React.DragEvent<HTMLDivElement>, sIndex: number, iIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    // Don't allow dragging across sections for now
    if (draggedItem.sectionIndex !== sIndex) return;
    if (draggedItem.itemIndex === iIndex) return;

    const next = [...sections];
    const items = [...next[sIndex].items];
    const [dragged] = items.splice(draggedItem.itemIndex, 1);
    items.splice(iIndex, 0, dragged);
    next[sIndex] = { ...next[sIndex], items };
    setSections(next);
    setDraggedItem({ sectionIndex: sIndex, itemIndex: iIndex });
  };

  const handleItemDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDraggedItem(null);
    commitSections(sections);
  };

  // ── Tab support in textarea ──────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, sIndex: number, iIndex: number) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end, value } = el;
    updateItem(sIndex, iIndex, "url", `${value.substring(0, s)}\t${value.substring(end)}`);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = s + 1;
    }, 0);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {sections.length === 0 ? (
        <div className="text-center py-10 bg-[#0a0e18] border border-dashed border-white/10 rounded-xl">
          <span
            className="material-symbols-outlined text-[32px] text-white/20 mb-3 block"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            auto_awesome
          </span>
          <p className="text-sm text-white/40 mb-4">No prompt sections added yet.</p>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-2 bg-[#00DBEE]/8 border border-[#00DBEE]/20 text-[#00DBEE]/80 hover:text-[#00DBEE] hover:bg-[#00DBEE]/14 hover:border-[#00DBEE]/35 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          >
            <Plus size={16} />
            Add First Section
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section, sIndex) => (
            <div
              key={section.id}
              draggable={draggedItem === null}
              onDragStart={(e) => handleSectionDragStart(e, sIndex)}
              onDragOver={(e) => handleSectionDragOver(e, sIndex)}
              onDragEnd={handleSectionDragEnd}
              className={`
                rounded-2xl overflow-hidden border transition-all duration-200
                ${
                  draggedSectionIndex === sIndex
                    ? "border-[#00DBEE]/40 shadow-[0_0_20px_rgba(0,219,238,0.12)] scale-[1.01] opacity-80"
                    : "border-white/10 bg-[#0a0f18]"
                }
              `}
            >
              {/* ── Section Header ── */}
              <div className="flex items-center gap-3 px-5 py-4 bg-white/[0.03] border-b border-white/5 cursor-move">
                <GripVertical className="text-white/20 shrink-0" size={18} />
                <FolderOpen className="text-[#00DBEE]/50 shrink-0" size={18} />
                <input
                  type="text"
                  value={section.sectionTitle}
                  onChange={(e) => updateSectionTitle(sIndex, e.target.value)}
                  placeholder="Section Title (e.g. AI PROMPTS)"
                  className="flex-1 bg-transparent border-none text-base font-bold text-white placeholder-white/20 focus:ring-0 outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={() => deleteSection(sIndex)}
                  className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors shrink-0"
                  title="Delete Section"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* ── Items List ── */}
              <div className="p-5 space-y-4 bg-[#05080f]">
                {section.items.map((item, iIndex) => (
                  <div
                    key={iIndex}
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, sIndex, iIndex)}
                    onDragOver={(e) => handleItemDragOver(e, sIndex, iIndex)}
                    onDragEnd={handleItemDragEnd}
                    className={`
                      rounded-xl overflow-hidden border transition-all duration-200
                      ${
                        draggedItem?.sectionIndex === sIndex && draggedItem?.itemIndex === iIndex
                          ? "border-[#00DBEE]/40 shadow-[0_0_20px_rgba(0,219,238,0.12)] scale-[1.01] opacity-80"
                          : "border-white/8 bg-[#0e1420]"
                      }
                    `}
                  >
                    {/* Item Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/5 cursor-move">
                      <GripVertical className="text-white/25 shrink-0" size={16} />
                      <span className="flex-1 text-sm font-medium text-white/70 truncate">
                        {item.label || `Prompt Item ${iIndex + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteItem(sIndex, iIndex)}
                        className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors shrink-0"
                        title="Delete Item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Item Body */}
                    <div className="p-4 space-y-4">
                      {/* Prompt Title */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#00DBEE]/50 mb-1.5">
                          <Type size={12} />
                          Prompt Title <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.label}
                          onChange={(e) => updateItem(sIndex, iIndex, "label", e.target.value)}
                          placeholder="e.g. Camera Prompt"
                          className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/25 focus:ring-1 focus:ring-[#00DBEE]/40 focus:border-[#00DBEE]/30 outline-none transition-colors"
                        />
                      </div>

                      {/* Prompt Text */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#00DBEE]/50 mb-1.5">
                          <Type size={12} />
                          Prompt Text <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          required
                          value={item.url}
                          onChange={(e) => {
                            updateItem(sIndex, iIndex, "url", e.target.value);
                            const el = e.target;
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => handleKeyDown(e, sIndex, iIndex)}
                          placeholder="Enter your full prompt text here… (Tab & multi-line supported)"
                          className="w-full min-h-[120px] bg-[#080c14] border border-white/10 rounded-lg px-3 py-3 text-sm font-mono text-white/80 placeholder-white/20 focus:ring-1 focus:ring-[#00DBEE]/40 focus:border-[#00DBEE]/30 outline-none transition-colors resize-y"
                          style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
                        />
                      </div>

                      <div className="h-px bg-white/5" />

                      {/* Website fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
                            <LinkIcon size={12} />
                            Website Button Label
                          </label>
                          <input
                            type="text"
                            value={item.websiteLabel ?? ""}
                            onChange={(e) => updateItem(sIndex, iIndex, "websiteLabel", e.target.value)}
                            placeholder="e.g. Visit Ponytail"
                            className="w-full bg-[#080c14] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:ring-1 focus:ring-[#00DBEE]/30 focus:border-[#00DBEE]/25 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
                            <LinkIcon size={12} />
                            Website URL
                          </label>
                          <input
                            type="url"
                            value={item.websiteUrl ?? ""}
                            onChange={(e) => updateItem(sIndex, iIndex, "websiteUrl", e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-[#080c14] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:ring-1 focus:ring-[#00DBEE]/30 focus:border-[#00DBEE]/25 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* Live button preview */}
                      {item.websiteUrl?.trim() && (
                        <div className="pt-1">
                          <p className="text-[10px] text-white/25 mb-2 uppercase tracking-widest">
                            Button Preview
                          </p>
                          <div className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-[#00DBEE]/30 bg-[#00DBEE]/5 text-[#00DBEE]/80 text-sm font-semibold pointer-events-none select-none">
                            <span
                              className="material-symbols-outlined text-[15px]"
                              style={{ fontVariationSettings: '"FILL" 0' }}
                            >
                              open_in_new
                            </span>
                            <span>{item.websiteLabel?.trim() || "Visit Website"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addItem(sIndex)}
                  className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#00DBEE]/5 border-2 border-dashed border-white/10 hover:border-[#00DBEE]/30 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-[#00DBEE]/90 transition-all duration-200"
                >
                  <Plus size={16} /> Add Prompt Item
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSection}
            className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-[#00DBEE]/5 border-2 border-dashed border-white/10 hover:border-[#00DBEE]/30 px-4 py-4 rounded-xl text-sm font-medium text-[#00DBEE]/70 hover:text-[#00DBEE] transition-all duration-200 shadow-sm hover:shadow-[0_0_20px_rgba(0,219,238,0.1)]"
          >
            <Plus size={18} /> Add New Section
          </button>
        </div>
      )}
    </div>
  );
}
