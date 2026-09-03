import { describe, expect, it } from "vitest";
import { classColor, classDesc, hexToRgba } from "./colors";

describe("classColor", () => {
  it("enam kelas punya warna berbeda", () => {
    const names = [
      "missing_hole",
      "mouse_bite",
      "open_circuit",
      "short",
      "spur",
      "spurious_copper",
    ];
    const colors = new Set(names.map(classColor));
    expect(colors.size).toBe(6);
  });

  it("kelas tak dikenal pakai abu netral", () => {
    expect(classColor("alien")).toBe("#a09d96");
  });
});

describe("classDesc", () => {
  it("mengembalikan deskripsi Indonesia", () => {
    expect(classDesc("short")).toContain("pendek");
  });

  it("fallback ke nama untuk kelas tak dikenal", () => {
    expect(classDesc("alien")).toBe("alien");
  });
});

describe("hexToRgba", () => {
  it("konversi tepat dengan alpha", () => {
    expect(hexToRgba("#30d158", 0.5)).toBe("rgba(48, 209, 88, 0.5)");
  });
});
