/**
 * lib/services/business-knowledge.ts
 *
 * Tenant-isolated business knowledge management.
 * Provides storage, retrieval, and full-text search of FAQs, product catalogs,
 * shipping guides, and internal support policies.
 * Strictly guarantees that no cross-tenant knowledge is ever returned.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KnowledgeDocumentMatch, ParsedEmailMessage } from "@/lib/supabase/types";

export interface KnowledgeDocumentRecord {
  id: string;
  business_id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export async function getBusinessKnowledge(businessId: string): Promise<KnowledgeDocumentRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) return [];

  try {
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, business_id, title, content, category, tags, created_at, updated_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[BusinessKnowledge] getBusinessKnowledge error:", error.message);
      return [];
    }

    return (data as KnowledgeDocumentRecord[]) || [];
  } catch {
    return [];
  }
}

export async function getRelevantBusinessKnowledge(
  email: ParsedEmailMessage,
  businessId: string,
  client?: any
): Promise<KnowledgeDocumentMatch[]> {
  const supabase = client || getSupabaseServerClient();
  if (!supabase || !businessId) return [];

  const queryText = `${email.subject || ""} ${(email.bodyText || "").slice(0, 300)}`.trim();
  if (!queryText) return [];

  try {
    // 1. Try full-text search RPC (tenant-scoped by p_business_id)
    const { data: rpcMatches, error: rpcErr } = await supabase.rpc("search_knowledge_text", {
      p_business_id: businessId,
      p_query: queryText,
      p_limit: 4,
    });

    if (!rpcErr && Array.isArray(rpcMatches) && rpcMatches.length > 0) {
      return rpcMatches.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        category: doc.category,
        rank: doc.rank,
      }));
    }

    // 2. Direct fallback query scoped to current business_id
    const { data: directDocs } = await supabase
      .from("knowledge_documents")
      .select("id, title, content, category")
      .eq("business_id", businessId)
      .limit(4);

    return (directDocs || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
    }));
  } catch (err: any) {
    console.warn("[BusinessKnowledge] Knowledge retrieval fallback:", err?.message);
    return [];
  }
}

export async function addBusinessKnowledge(
  businessId: string,
  doc: { title: string; content: string; category?: string; tags?: string[] }
): Promise<{ success: boolean; data?: KnowledgeDocumentRecord; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId) {
    return { success: false, error: "Database client unavailable or invalid business ID" };
  }

  try {
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        business_id: businessId,
        title: doc.title,
        content: doc.content,
        category: doc.category || "general",
        tags: doc.tags || [],
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as KnowledgeDocumentRecord };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to add knowledge document" };
  }
}

export async function deleteBusinessKnowledge(
  businessId: string,
  docId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !businessId || !docId) {
    return { success: false, error: "Database client unavailable or invalid IDs" };
  }

  try {
    const { error } = await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", docId)
      .eq("business_id", businessId); // Strict tenant isolation on delete

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to delete knowledge document" };
  }
}
