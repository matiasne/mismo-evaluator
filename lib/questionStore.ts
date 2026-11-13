"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { questionSchema, type Question } from "./questions";

const KEY = "mismo-evaluator:questions:v1";

const savedSchema = z.object({
  custom: z.array(questionSchema),
  /** Ids of default questions the user switched off. */
  disabled: z.array(z.string()),
});
export type SavedQuestions = z.infer<typeof savedSchema>;

const EMPTY: SavedQuestions = { custom: [], disabled: [] };
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: SavedQuestions } | undefined;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): SavedQuestions {
  const raw = readRaw();
  if (!cached || cached.raw !== raw) {
    let value = EMPTY;
    try {
      const parsed = savedSchema.safeParse(JSON.parse(raw ?? "null"));
      if (parsed.success) value = parsed.data;
    } catch {
      // Unreadable storage content: start from the defaults.
    }
    cached = { raw, value };
  }
  return cached.value;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function save(next: SavedQuestions): void {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Storage is unavailable (private window): keep the change for this page only.
  }
  cached = { raw: readRaw(), value: next };
  listeners.forEach((listener) => listener());
}

/** The user's own questions and switched-off defaults, kept in this browser. */
export function useSavedQuestions() {
  const saved = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return {
    saved,
    upsertCustom(question: Question) {
      const exists = saved.custom.some((q) => q.id === question.id);
      const custom = exists ? saved.custom.map((q) => (q.id === question.id ? question : q)) : [...saved.custom, question];
      save({ ...saved, custom });
    },
    removeCustom(id: string) {
      save({ ...saved, custom: saved.custom.filter((q) => q.id !== id) });
    },
    setEnabled(id: string, enabled: boolean) {
      const disabled = saved.disabled.filter((d) => d !== id);
      save({ ...saved, disabled: enabled ? disabled : [...disabled, id] });
    },
  };
}
