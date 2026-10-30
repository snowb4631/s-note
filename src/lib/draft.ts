import { type Card, salvageCard } from "./card/schema";
import { todayIso } from "./card/calc";

// Handwriting plus an image can exceed the localStorage quota, so IndexedDB is primary.
// localStorage is the fallback, and every failure ends in a status, never an exception.
const DB = "snote";
const STORE = "drafts";
const KEY = "current";
const LS_KEY = "snote.draft";

export type SaveStatus = "saved" | "saved-without-attachments" | "unavailable";
export type LoadedDraft = {
  card: Card;
  /** The stored copy had to leave out handwriting and the image. */
  dropped: boolean;
  /** Some fields were unusable and were reset. */
  repaired: boolean;
};

type StoredDraft = { savedAt: number; card: unknown; dropped?: boolean };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function tryLocal(run: (ls: Storage) => void): boolean {
  try {
    run(window.localStorage);
    return true;
  } catch {
    return false;
  }
}

export async function saveDraft(card: Card): Promise<SaveStatus> {
  const savedAt = Date.now();
  try {
    await idb("readwrite", (s) => s.put({ savedAt, card } satisfies StoredDraft, KEY));
    tryLocal((ls) => ls.removeItem(LS_KEY));
    return "saved";
  } catch {
    // fall through to localStorage
  }
  if (tryLocal((ls) => ls.setItem(LS_KEY, JSON.stringify({ savedAt, card } satisfies StoredDraft)))) return "saved";
  const light: Card = {
    ...card,
    image: null,
    reason: { ...card.reason, strokes: [] },
    memo: { ...card.memo, strokes: [] },
  };
  if (tryLocal((ls) => ls.setItem(LS_KEY, JSON.stringify({ savedAt, card: light, dropped: true } satisfies StoredDraft)))) return "saved-without-attachments";
  return "unavailable";
}

/** Drafts from before timestamps are bare cards, and count as the oldest. */
function toStored(value: unknown): StoredDraft | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object" && "savedAt" in value && "card" in value && typeof value.savedAt === "number") {
    return value as StoredDraft;
  }
  return { savedAt: 0, card: value };
}

/** The newest usable copy across both stores. IndexedDB wins a tie. */
export function chooseDraft(fromIdb: unknown, fromLocal: unknown, today: string): (LoadedDraft & { source: "idb" | "local" }) | null {
  const copies = [
    { source: "idb" as const, stored: toStored(fromIdb) },
    { source: "local" as const, stored: toStored(fromLocal) },
  ].sort((a, b) => (b.stored?.savedAt ?? -1) - (a.stored?.savedAt ?? -1));
  for (const { source, stored } of copies) {
    if (!stored) continue;
    const result = salvageCard(stored.card, today);
    if (result) return { ...result, dropped: stored.dropped === true, source };
  }
  return null;
}

export async function loadDraft(): Promise<LoadedDraft | null> {
  let fromIdb: unknown = null;
  try {
    fromIdb = await idb("readonly", (s) => s.get(KEY));
  } catch {
    // only localStorage is left
  }
  let fromLocal: unknown = null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    fromLocal = raw ? JSON.parse(raw) : null;
  } catch {
    // unavailable or corrupt
  }
  const chosen = chooseDraft(fromIdb, fromLocal, todayIso());
  if (!chosen) return null;
  if (chosen.source === "local" && fromIdb) {
    // The IndexedDB copy lost, so it must not come back later. Best effort: timestamps cover a failure.
    void idb("readwrite", (s) => s.delete(KEY)).catch(() => {});
  }
  return { card: chosen.card, dropped: chosen.dropped, repaired: chosen.repaired };
}

export async function clearDraft(): Promise<void> {
  try {
    await idb("readwrite", (s) => s.delete(KEY));
  } catch {
    // nothing stored there, or storage is unavailable
  }
  tryLocal((ls) => ls.removeItem(LS_KEY));
}
