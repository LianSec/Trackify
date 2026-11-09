import type { SupabaseClient } from "@supabase/supabase-js";
import type { Backend, DocData } from "./backend";

interface DocRow {
  id: string;
  data: DocData;
}

/**
 * Speichert jedes Dokument als Zeile in der Tabelle `docs`.
 * Row Level Security sorgt dafür, dass jeder Nutzer nur seine eigenen Zeilen sieht.
 */
export class SupabaseBackend implements Backend {
  readonly kind = "cloud" as const;

  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async load(): Promise<Record<string, DocData>> {
    const { data, error } = await this.db.from("docs").select("id, data").eq("user_id", this.userId);
    if (error) throw error;
    const out: Record<string, DocData> = {};
    for (const row of (data ?? []) as DocRow[]) out[row.id] = row.data;
    return out;
  }

  async save(id: string, data: DocData): Promise<void> {
    const { error } = await this.db
      .from("docs")
      .upsert({ user_id: this.userId, id, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  subscribe(onDoc: (id: string, data: DocData) => void): () => void {
    const channel = this.db
      .channel("docs-" + this.userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "docs", filter: `user_id=eq.${this.userId}` },
        (payload) => {
          const row = payload.new as Partial<DocRow> | null;
          if (row && typeof row.id === "string" && row.data) onDoc(row.id, row.data);
        },
      )
      .subscribe();
    return () => {
      void this.db.removeChannel(channel);
    };
  }
}
