import type { Backend, DocData } from "./backend";

const KEY = "trackify-docs-v1";

/** Speichert alle Dokumente in localStorage. Funktioniert ohne Konto, aber nur auf diesem Gerät. */
export class LocalBackend implements Backend {
  readonly kind = "local" as const;

  private read(): Record<string, DocData> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Record<string, DocData>) : {};
    } catch {
      return {};
    }
  }

  async load(): Promise<Record<string, DocData>> {
    return this.read();
  }

  async save(id: string, data: DocData): Promise<void> {
    const all = this.read();
    all[id] = data;
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  subscribe(): () => void {
    return () => {};
  }
}
