"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type PendingContextValue = {
  isPending: (key: string) => boolean;
  startPending: (key: string) => void;
  finishPending: (key: string) => void;
};

const PendingContext = createContext<PendingContextValue>({
  isPending: () => false,
  startPending: () => {},
  finishPending: () => {},
});

export function PendingProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const counterRef = useRef<Map<string, number>>(new Map());

  const startPending = useCallback((key: string) => {
    counterRef.current.set(key, (counterRef.current.get(key) ?? 0) + 1);
    setPending((prev) => new Set(prev).add(key));
  }, []);

  const finishPending = useCallback((key: string) => {
    const count = (counterRef.current.get(key) ?? 1) - 1;
    if (count <= 0) {
      counterRef.current.delete(key);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      counterRef.current.set(key, count);
    }
  }, []);

  const isPending = useCallback((key: string) => pending.has(key), [pending]);

  return (
    <PendingContext.Provider value={{ isPending, startPending, finishPending }}>
      {children}
    </PendingContext.Provider>
  );
}

export function usePending() {
  return useContext(PendingContext);
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
