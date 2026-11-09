/** Ein Speicher-Backend: lokal im Browser oder Supabase in der Cloud. */
export type DocData = Record<string, unknown>;

export interface Backend {
  readonly kind: "local" | "cloud";
  /** Alle Dokumente des angemeldeten Nutzers laden. */
  load(): Promise<Record<string, DocData>>;
  /** Ein Dokument vollständig speichern (Upsert). */
  save(id: string, data: DocData): Promise<void>;
  /** Änderungen von anderen Geräten empfangen. Gibt eine Abmelde-Funktion zurück. */
  subscribe(onDoc: (id: string, data: DocData) => void): () => void;
}
