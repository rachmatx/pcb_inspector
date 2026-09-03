import type { Detection } from "./api";

/** IoU dua bbox (format {x1,y1,x2,y2}). */
export function boxIou(
  a: Detection["bbox"],
  b: Detection["bbox"],
): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter <= 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

export type MatchResult = {
  matched: { a: Detection; b: Detection }[];
  onlyA: Detection[];
  onlyB: Detection[];
};

/**
 * Cocokkan deteksi A vs B: pasangan sekelas dengan IoU >= iouMin dianggap
 * objek sama (greedy, satu B hanya dipakai sekali).
 */
export function matchDetections(
  listA: Detection[],
  listB: Detection[],
  iouMin = 0.5,
): MatchResult {
  const usedB = new Set<number>();
  const matched: { a: Detection; b: Detection }[] = [];
  const onlyA: Detection[] = [];
  for (const da of listA) {
    let best = -1;
    let bestIoU = 0;
    listB.forEach((db, j) => {
      if (usedB.has(j) || db.class_name !== da.class_name) return;
      const v = boxIou(da.bbox, db.bbox);
      if (v > bestIoU) {
        bestIoU = v;
        best = j;
      }
    });
    if (best >= 0 && bestIoU >= iouMin) {
      usedB.add(best);
      matched.push({ a: da, b: listB[best] });
    } else {
      onlyA.push(da);
    }
  }
  const onlyB = listB.filter((_, j) => !usedB.has(j));
  return { matched, onlyA, onlyB };
}

/** Hitung kemunculan per kelas, urut terbanyak dulu. */
export function groupCounts(ds: Detection[]): [string, number][] {
  const c: Record<string, number> = {};
  ds.forEach((d) => {
    c[d.class_name] = (c[d.class_name] ?? 0) + 1;
  });
  return Object.entries(c).sort((x, y) => y[1] - x[1]);
}
