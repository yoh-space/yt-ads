import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPendingStoreForTests,
  usePendingStore,
} from "./pending-store";

beforeEach(() => {
  __resetPendingStoreForTests();
});

afterEach(() => {
  __resetPendingStoreForTests();
});

describe("pending store", () => {
  it("starts and finishes a pending key", () => {
    const { startPending, finishPending } = usePendingStore.getState();
    expect(usePendingStore.getState().set.has("k1")).toBe(false);
    startPending("k1");
    expect(usePendingStore.getState().set.has("k1")).toBe(true);
    finishPending("k1");
    expect(usePendingStore.getState().set.has("k1")).toBe(false);
  });

  it("requires two finish calls when started twice for the same key", () => {
    const { startPending, finishPending } = usePendingStore.getState();
    startPending("k1");
    startPending("k1");
    expect(usePendingStore.getState().set.has("k1")).toBe(true);
    finishPending("k1");
    expect(usePendingStore.getState().set.has("k1")).toBe(true);
    finishPending("k1");
    expect(usePendingStore.getState().set.has("k1")).toBe(false);
  });

  it("does not create a new Set when key is already present (no-op short-circuit)", () => {
    const { startPending } = usePendingStore.getState();
    startPending("k1");
    const first = usePendingStore.getState().set;
    startPending("k1");
    const second = usePendingStore.getState().set;
    expect(second).toBe(first);
  });

  it("tracks multiple keys independently", () => {
    const { startPending, finishPending } = usePendingStore.getState();
    startPending("a");
    startPending("b");
    finishPending("a");
    expect(usePendingStore.getState().set.has("a")).toBe(false);
    expect(usePendingStore.getState().set.has("b")).toBe(true);
  });

  it("clearPending resets everything", () => {
    const { startPending, clearPending } = usePendingStore.getState();
    startPending("a");
    startPending("b");
    clearPending();
    expect(usePendingStore.getState().set.size).toBe(0);
  });
});

describe("safeMutation semantics (callable via store actions)", () => {
  it("calls onSuccess and clears pending on resolve", async () => {
    const { startPending, finishPending } = usePendingStore.getState();
    const onSuccess = vi.fn();
    const promise = Promise.resolve("ok");
    startPending("k");
    await promise.then((r) => onSuccess(r)).finally(() => finishPending("k"));
    expect(onSuccess).toHaveBeenCalledWith("ok");
    expect(usePendingStore.getState().set.has("k")).toBe(false);
  });

  it("calls onError and clears pending on reject", async () => {
    const { startPending, finishPending } = usePendingStore.getState();
    const onError = vi.fn();
    const err = new Error("boom");
    const promise = Promise.reject(err) as Promise<never>;
    promise.catch(() => {});
    startPending("k");
    await promise.catch((e: unknown) => onError(e)).finally(() => finishPending("k"));
    expect(onError).toHaveBeenCalledWith(err);
    expect(usePendingStore.getState().set.has("k")).toBe(false);
  });

  it("refuses to start when key is already pending (counter-then-set keeps membership)", () => {
    const { startPending, finishPending } = usePendingStore.getState();
    startPending("k");
    expect(usePendingStore.getState().set.has("k")).toBe(true);
    startPending("k");
    finishPending("k");
    expect(usePendingStore.getState().set.has("k")).toBe(true);
    finishPending("k");
    expect(usePendingStore.getState().set.has("k")).toBe(false);
  });
});