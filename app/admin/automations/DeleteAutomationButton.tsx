"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAutomation } from "./actions";

export default function DeleteAutomationButton({ id, title }: { id: string; title: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return;
    
    setIsDeleting(true);
    try {
      await deleteAutomation(id);
    } catch (error) {
      console.error(error);
      setIsDeleting(false);
      alert("Failed to delete automation.");
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
      title="Delete"
    >
      <Trash2 size={18} />
    </button>
  );
}
