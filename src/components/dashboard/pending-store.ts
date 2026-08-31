"use client";

import { useCallback } from "react";
import { create } from "zustand";

type PendingStore = {
  set: Set<string>;
  startPending: (key: string) => void;
  finishPending: (key: string) => void;
  clearPending: () => void;
};

const counter = new Map<string, number>();

export const usePendingStore = create<PendingStore>((set) => ({
  set: new Set<string>(),
  startPending: (key) => {
    counter.set(key, (counter.get(key) ?? 0) + 1);
    set((state) => {
      if (state.set.has(key)) return state;
      const next = new Set(state.set);
      next.add(key);
      return { set: next };
    });
  },
  finishPending: (key) => {
    const remaining = (counter.get(key) ?? 1) - 1;
    if (remaining <= 0) {
      counter.delete(key);
      set((state) => {
        if (!state.set.has(key)) return state;
        const next = new Set(state.set);
        next.delete(key);
        return { set: next };
      });
    } else {
      counter.set(key, remaining);
    }
  },
  clearPending: () => {
    counter.clear();
    set({ set: new Set<string>() });
  },
}));

export function usePending() {
  const isPending = usePendingStore((s) => (key: string) => s.set.has(key));
  const startPending = usePendingStore((s) => s.startPending);
  const finishPending = usePendingStore((s) => s.finishPending);
  return { isPending, startPending, finishPending };
}

export function useSafeMutation() {
  const { isPending, startPending, finishPending } = usePending();

  const safeMutation = useCallback(
    <Result,>(
      key: string,
      promise: Promise<Result>,
      onSuccess?: (result: Result) => void,
      onError?: (error: unknown) => void,
    ) => {
      if (isPending(key)) return;
      startPending(key);
      void promise
        .then((result) => {
          onSuccess?.(result);
        })
        .catch((error: unknown) => {
          onError?.(error);
        })
        .finally(() => {
          finishPending(key);
        });
    },
    [isPending, startPending, finishPending],
  );

  return { isPending, safeMutation };
}

export function __resetPendingStoreForTests() {
  counter.clear();
  usePendingStore.setState({ set: new Set<string>() });
}