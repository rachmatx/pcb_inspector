import { describe, expect, it } from "vitest";
import { boxIou, groupCounts, matchDetections } from "./compare";
import type { Detection } from "./api";

const det = (
  class_name: string,
  confidence: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Detection => ({
  class_id: 0,
  class_name,
  confidence,
  bbox: { x1, y1, x2, y2 },
});

describe("boxIou", () => {
  it("1 untuk box identik, 0 untuk lepas", () => {
    const a = det("short", 0.9, 0, 0, 10, 10);
    expect(boxIou(a.bbox, a.bbox)).toBeCloseTo(1.0);
    expect(
      boxIou(a.bbox, det("short", 0.9, 20, 20, 30, 30).bbox),
    ).toBe(0);
  });

  it("tumpang setengah: inter 25, union 175", () => {
    expect(
      boxIou(
        det("short", 0.9, 0, 0, 10, 10).bbox,
        det("short", 0.9, 5, 5, 15, 15).bbox,
      ),
    ).toBeCloseTo(25 / 175);
  });

  it("0 untuk box degenerat", () => {
    expect(
      boxIou(
        det("short", 0.9, 5, 5, 5, 5).bbox,
        det("short", 0.9, 0, 0, 10, 10).bbox,
      ),
    ).toBe(0);
  });
});

describe("matchDetections", () => {
  it("memasangkan sekelas yang bertumpang", () => {
    const a = [det("short", 0.9, 0, 0, 10, 10)];
    const b = [det("short", 0.8, 1, 1, 11, 11)];
    const m = matchDetections(a, b);
    expect(m.matched).toHaveLength(1);
    expect(m.onlyA).toHaveLength(0);
    expect(m.onlyB).toHaveLength(0);
  });

  it("tidak memasangkan kelas beda walau bertumpang", () => {
    const a = [det("short", 0.9, 0, 0, 10, 10)];
    const b = [det("open_circuit", 0.8, 0, 0, 10, 10)];
    const m = matchDetections(a, b);
    expect(m.matched).toHaveLength(0);
    expect(m.onlyA).toHaveLength(1);
    expect(m.onlyB).toHaveLength(1);
  });

  it("tidak memasangkan IoU di bawah ambang", () => {
    const a = [det("short", 0.9, 0, 0, 10, 10)];
    const b = [det("short", 0.8, 9, 9, 19, 19)]; // IoU ~0.005
    const m = matchDetections(a, b);
    expect(m.matched).toHaveLength(0);
  });

  it("satu B hanya dipakai sekali (greedy conf tertinggi dulu)", () => {
    const a = [
      det("short", 0.9, 0, 0, 10, 10),
      det("short", 0.7, 0, 0, 10, 10),
    ];
    const b = [det("short", 0.8, 0, 0, 10, 10)];
    const m = matchDetections(a, b);
    expect(m.matched).toHaveLength(1);
    expect(m.matched[0].a.confidence).toBe(0.9);
    expect(m.onlyA).toHaveLength(1);
  });

  it("kosong vs kosong", () => {
    const m = matchDetections([], []);
    expect(m).toEqual({ matched: [], onlyA: [], onlyB: [] });
  });
});

describe("groupCounts", () => {
  it("urut terbanyak dulu", () => {
    const ds = [
      det("short", 0.9, 0, 0, 1, 1),
      det("open_circuit", 0.8, 0, 0, 1, 1),
      det("short", 0.7, 0, 0, 1, 1),
    ];
    expect(groupCounts(ds)).toEqual([
      ["short", 2],
      ["open_circuit", 1],
    ]);
  });
});
