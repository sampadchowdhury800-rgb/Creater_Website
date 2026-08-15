"use client";

import { Plus, Trash2 } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
  sortOrder?: number;
}

interface FaqEditorProps {
  faqs: FaqItem[];
  onChange: (faqs: FaqItem[]) => void;
}

export default function FaqEditor({ faqs = [], onChange }: FaqEditorProps) {
  const handleAddFaq = () => {
    onChange([...faqs, { question: "", answer: "", sortOrder: faqs.length + 1 }]);
  };

  const handleUpdateFaq = (index: number, field: "question" | "answer", val: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  const handleRemoveFaq = (index: number) => {
    onChange(faqs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-200">
            Frequently Asked Questions (FAQ)
          </h4>
          <p className="text-xs text-gray-400">
            Visible on page &amp; automatically rendered in FAQPage JSON-LD structured data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddFaq}
          className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono flex items-center gap-1 hover:bg-cyan-900/50 transition-colors"
        >
          <Plus size={14} /> Add FAQ
        </button>
      </div>

      {faqs.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-gray-400">
          No FAQs added yet. Click &quot;Add FAQ&quot; to provide direct Q&amp;A for search engines and AI assistants.
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  Q#{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFaq(idx)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="Remove FAQ"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Question</label>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => handleUpdateFaq(idx, "question", e.target.value)}
                  placeholder="e.g. What platforms can this automation connect with?"
                  className="w-full rounded-lg border border-white/10 bg-black/40 text-white text-xs px-3 py-2 focus:border-cyan-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Answer</label>
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => handleUpdateFaq(idx, "answer", e.target.value)}
                  placeholder="Detailed, direct factual answer..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 text-white text-xs px-3 py-2 focus:border-cyan-400 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
