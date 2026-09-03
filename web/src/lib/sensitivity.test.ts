import { describe, expect, it } from "vitest";
import { DEFAULT_CONF, SENS_PRESETS, sensitivityLabelFor } from "./sensitivity";

describe("sensitivityLabelFor", () => {
  it("menamai preset yang cocok", () => {
    expect(sensitivityLabelFor(0.3)).toBe("High recall (30%)");
    expect(sensitivityLabelFor(0.45)).toBe("Balance (45%)");
    expect(sensitivityLabelFor(0.6)).toBe("High precision (60%)");
  });

  it("menandai nilai non-preset sebagai Kustom", () => {
    expect(sensitivityLabelFor(0.52)).toBe("Kustom (52%)");
    expect(sensitivityLabelFor(0.05)).toBe("Kustom (5%)");
  });

  it("toleran terhadap galat floating point slider", () => {
    expect(sensitivityLabelFor(0.4499999)).toBe("Balance (45%)");
  });

  it("default adalah Balance 0.45 dan ada di preset", () => {
    expect(DEFAULT_CONF).toBe(0.45);
    expect(SENS_PRESETS.some((p) => p.value === DEFAULT_CONF)).toBe(true);
  });
});
