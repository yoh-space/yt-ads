import { describe, expect, it, vi, beforeEach } from "vitest";
import { playSynthesizedChime, unlockAudio } from "./useNotification";

describe("useNotification Audio & Chime System", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("safely invokes playSynthesizedChime without throwing even if AudioContext is mocked", () => {
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockCtx = {
      currentTime: 10,
      state: "suspended",
      resume: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
    };

    vi.stubGlobal(
      "AudioContext",
      vi.fn().mockImplementation(() => mockCtx),
    );

    expect(() => playSynthesizedChime()).not.toThrow();
  });

  it("safely invokes unlockAudio without throwing", () => {
    const mockResume = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "AudioContext",
      vi.fn().mockImplementation(() => ({
        state: "suspended",
        resume: mockResume,
      })),
    );

    expect(() => unlockAudio()).not.toThrow();
  });
});
