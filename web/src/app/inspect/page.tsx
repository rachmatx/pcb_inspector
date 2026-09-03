"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeaderSimple } from "@/components/SiteHeaderSimple";
import { Toaster, notify } from "@/components/Toaster";
import { ZoomableViewer, type OverlayBox } from "@/components/ZoomableViewer";
import { DetectionTable } from "@/components/inspect/DetectionTable";
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  DownloadIcon,
  ImageIcon,
  LoaderIcon,
  PrinterIcon,
  RefreshIcon,
  ScanIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import {
  demoHealth,
  demoModels,
  demoPredict,
  exitDemoMode,
  initDemoMode,
} from "@/lib/demo";
import {
  API_BASE,
  checkHealth,
  predictImage,
  fetchModels,
  fetchModelDefault,
  downloadAnnotatedImage,
  downloadCSV,
  downloadJSON,
  getImageSize,
  makeThumbnailWithBoxes,
  prepareUploadImage,
  printReport,
  isNonPcb,
  PCB_SCORE_MIN,
  type HealthResponse,
  type ModelInfo,
  type PredictionResponse,
} from "@/lib/api";
import { DEFAULT_CONF, SENS_PRESETS, sensitivityLabelFor } from "@/lib/sensitivity";
import { classColor, classDesc, hexToRgba } from "@/lib/colors";
import { groupCounts, matchDetections } from "@/lib/compare";

type BackendStatus = "checking" | "online" | "offline";
type SaveState = "idle" | "saving" | "saved" | "not-logged-in" | "skipped-non-pcb";

/** Batas box yang digambar di viewer — 100 teratas berdasar keyakinan.
 *  Tabel tetap menampilkan semuanya; ID stabil (indeks asli) agar
 *  hover/fokus sinkron. */
const MAX_OVERLAY_BOXES = 100;
/** Batas ukuran file — di atas ini ditolak dengan pesan jelas. */
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Sample = { name: string; url: string; label: string; desc: string };

/** Gambar contoh dari dataset (public/contoh) — sekali klik langsung dianalisis. */
const SAMPLES: Sample[] = [
  {
    name: "contoh-open-circuit.jpg",
    url: "/contoh/contoh-open-circuit.jpg",
    label: "Open circuit",
    desc: "Jalur terputus",
  },
  {
    name: "contoh-short.jpg",
    url: "/contoh/contoh-short.jpg",
    label: "Short",
    desc: "Hubungan pendek",
  },
  {
    name: "contoh-struk.png",
    url: "/contoh/contoh-struk.png",
    label: "Bukan PCB",
    desc: "Struk — uji warning",
  },
];

export default function InspectPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [previews, setPreviews] = useState<(string | null)[]>([]);
  const [results, setResults] = useState<(PredictionResponse | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [backend, setBackend] = useState<BackendStatus>("checking");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [requestConf, setRequestConf] = useState(DEFAULT_CONF);
  const [displayConf, setDisplayConf] = useState(DEFAULT_CONF);
  const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);
  const focusTickRef = useRef(0);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  // Perbandingan dua model pada gambar aktif.
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareModel, setCompareModel] = useState("");
  const [compareResult, setCompareResult] = useState<PredictionResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareHoveredId, setCompareHoveredId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  // Override "ini PCB" per file (nama+ukuran) — tanpa reset manual,
  // otomatis tidak berlaku saat ganti gambar.
  const [pcbAckKey, setPcbAckKey] = useState<string | null>(null);
  const fileKey = (f: File | null) => (f ? `${f.name}::${f.size}` : "");
  const isAcked = (f: File | null) => !!f && pcbAckKey === fileKey(f);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const refreshBackend = async () => {
    setBackend("checking");
    const h = await checkHealth();
    if (h) {
      setHealth(h);
      setBackend("online");
    } else {
      setBackend("offline");
    }
  };

  useEffect(() => {
    // Init khusus-klien (sessionStorage) — harus di effect agar HTML
    // server (demo=false) sama dengan render pertama klien. Tanpa ini
    // terjadi hydration mismatch saat flag demo tersimpan.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only
    setDemo(initDemoMode());
  }, []);

  useEffect(() => {
    let active = true;
    if (demo) {
      // Mode demo: model + status dari rekaman, tanpa backend.
      demoModels()
        .then((ms) => {
          if (!active) return;
          setModels(ms);
          if (ms.length > 0)
            setSelectedModel(
              (prev) =>
                prev ||
                ms.find((m) => m.id === "best-e03v2-yolov8s")?.id ||
                ms[0].id,
            );
          setHealth(demoHealth(ms));
          setBackend("online");
        })
        .catch(() => {
          if (active) setBackend("offline");
        });
      return () => {
        active = false;
      };
    }
    checkHealth().then((h) => {
      if (!active) return;
      if (h) {
        setHealth(h);
        setBackend("online");
      } else {
        setBackend("offline");
      }
    });
    return () => {
      active = false;
    };
  }, [demo]);

  // Muat daftar model dari backend (dilewati saat mode demo).
  // Pilihan default mengikuti backend (/models.default), bukan urutan list.
  useEffect(() => {
    if (demo) return;
    let active = true;
    Promise.all([fetchModels(), fetchModelDefault()]).then(([ms, def]) => {
      if (!active) return;
      setModels(ms);
      if (ms.length > 0)
        setSelectedModel(
          (prev) =>
            prev || (def && ms.some((m) => m.id === def) ? def : ms[0].id),
        );
    });
    return () => {
      active = false;
    };
  }, [demo]);

  const activeFile = files[activeIdx] ?? null;
  const activePreview = previews[activeIdx] ?? null;
  const activeResult = results[activeIdx] ?? null;

  const addFiles = (list: FileList | File[]) => {
    const all = Array.from(list);
    const okType = (f: File) => /image\/(jpeg|png|bmp)/.test(f.type);
    const badType = all.filter((f) => !okType(f));
    const tooBig = all.filter((f) => okType(f) && f.size > MAX_FILE_BYTES);
    const arr = all.filter((f) => okType(f) && f.size <= MAX_FILE_BYTES);
    if (badType.length > 0) {
      const msg = `${badType.length} file ditolak — hanya JPG, PNG, atau BMP yang didukung.`;
      setError(msg);
      notify("error", msg);
    }
    if (tooBig.length > 0) {
      const names = tooBig
        .slice(0, 2)
        .map((f) => `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`)
        .join(", ");
      const msg = `${tooBig.length} file ditolak — melebihi batas 15 MB: ${names}${tooBig.length > 2 ? "…" : ""}. Perkecil/kompres gambar lalu coba lagi.`;
      setError(msg);
      notify("error", msg);
    }
    if (arr.length === 0) return;
    setFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [
      ...prev,
      ...arr.map((f) => URL.createObjectURL(f)),
    ]);
    setResults((prev) => [...prev, ...arr.map(() => null)]);
    if (badType.length === 0 && tooBig.length === 0) setError(null);
    setSaveState("idle");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const resetAll = () => {
    previews.forEach((p) => p && URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setResults([]);
    setActiveIdx(0);
    setError(null);
    setNaturalSize(null);
    setSaveState("idle");
    setCompareResult(null);
  };

  const removeAt = (i: number) => {
    if (previews[i]) URL.revokeObjectURL(previews[i]);
    const nextFiles = files.filter((_, x) => x !== i);
    const nextPrev = previews.filter((_, x) => x !== i);
    const nextRes = results.filter((_, x) => x !== i);
    setFiles(nextFiles);
    setPreviews(nextPrev);
    setResults(nextRes);
    if (activeIdx >= nextFiles.length) setActiveIdx(Math.max(0, nextFiles.length - 1));
    setNaturalSize(null);
    setSaveState("idle");
  };

  const runPredict = async (file: File, conf: number, modelId?: string) => {
    if (demo) return demoPredict(file, modelId);
    // Kompres sisi-klien (>2 MB → JPEG 0.85, dimensi tetap) agar upload
    // bukan bottleneck; bbox backend tetap valid terhadap gambar asli.
    const data = await predictImage(await prepareUploadImage(file), {
      conf,
      modelId: modelId || undefined,
    });
    return data;
  };

  const saveOne = async (
    file: File,
    data: PredictionResponse,
    conf: number,
  ): Promise<SaveState> => {
    try {
      const size = await getImageSize(file);
      let thumb = "";
      if (size) {
        thumb = await makeThumbnailWithBoxes(
          file,
          data.detections,
          size.w,
          size.h,
          480,
        );
      }
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageName: file.name,
          modelVersion: data.model_id ?? data.model_version,
          inferenceMs: data.inference_ms,
          detections: data.detections,
          thumbnail: thumb || undefined,
          imageWidth: size?.w,
          imageHeight: size?.h,
          threshold: conf,
        }),
      });
      if (res.status === 401) return "not-logged-in";
      return res.ok ? "saved" : "not-logged-in";
    } catch {
      return "not-logged-in";
    }
  };

  /** Muat gambar contoh dari public/contoh lalu langsung analisis. */
  const loadSample = async (s: Sample) => {
    if (loading || sampleLoading) return;
    setSampleLoading(s.name);
    setError(null);
    setCompareResult(null);
    try {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error("Gagal memuat gambar contoh.");
      const blob = await res.blob();
      const file = new File([blob], s.name, {
        type: blob.type || "image/jpeg",
      });
      const idx = files.length;
      setFiles((prev) => [...prev, file]);
      setPreviews((prev) => [...prev, URL.createObjectURL(file)]);
      setResults((prev) => [...prev, null]);
      setActiveIdx(idx);
      setNaturalSize(null);
      setSaveState("idle");
      setHoveredId(null);
      setLoading(true);
      try {
        const data = await runPredict(file, requestConf, selectedModel);
        setResults((prev) => {
          const next = [...prev];
          next[idx] = data;
          return next;
        });
        if (isNonPcb(data) && !isAcked(file)) {
          setSaveState("skipped-non-pcb");
          notify("info", "Gambar ini tampaknya bukan PCB — tidak disimpan.");
        } else {
          const st = await saveOne(file, data, requestConf);
          setSaveState(st);
          notify(
            "success",
            st === "saved"
              ? "Contoh dianalisis & tersimpan ke riwayat."
              : "Contoh selesai dianalisis.",
          );
        }
        setDisplayConf(requestConf);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal memuat gambar contoh.";
      setError(msg);
      notify("error", msg);
    } finally {
      setSampleLoading(null);
    }
  };

  /** Bandingkan gambar aktif dengan model kedua pada ambang yang sama. */
  const runCompare = async () => {
    if (!activeFile || !compareModel || comparing) return;
    setComparing(true);
    try {
      const data = await runPredict(activeFile, requestConf, compareModel);
      setCompareResult(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Gagal membandingkan model.";
      notify("error", msg);
    } finally {
      setComparing(false);
    }
  };

  const handleAnalyzeAll = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setSaveState("idle");
    setHoveredId(null);
    setCompareResult(null);
    const newResults = [...results];
    // Simpan riwayat berjalan paralel dengan analisis gambar berikutnya —
    // hasil tiap gambar tampil seketika tanpa menunggu thumbnail/DB.
    const saves: Promise<SaveState>[] = [];
    let done = 0;
    let savedAny = false;
    let skippedNonPcb = false;
    try {
      for (let i = 0; i < files.length; i++) {
        setActiveIdx(i);
        setNaturalSize(null);
        const data = await runPredict(files[i], requestConf, selectedModel);
        newResults[i] = data;
        setResults([...newResults]);
        done++;
        if (isNonPcb(data) && !isAcked(files[i])) {
          skippedNonPcb = true;
          notify(
            "info",
            `${files[i].name} tampaknya bukan PCB — tidak disimpan ke riwayat.`,
          );
        } else {
          saves.push(
            saveOne(files[i], data, requestConf).then((st) => {
              if (st === "saved") savedAny = true;
              return st;
            }),
          );
        }
      }
      setDisplayConf(requestConf);
      setSaveState("saving");
      const statuses = await Promise.all(saves);
      const lastSave = statuses.length > 0 ? statuses[statuses.length - 1] : "idle";
      setSaveState(
        savedAny ? "saved" : skippedNonPcb ? "skipped-non-pcb" : lastSave,
      );
      if (savedAny)
        notify("success", `Selesai — ${done} gambar tersimpan ke riwayat.`);
      else if (!skippedNonPcb)
        notify("success", `Selesai — ${done} gambar dianalisis.`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Gagal menghubungi server. Pastikan backend berjalan.";
      setError(msg);
      notify("error", msg);
      setSaveState("idle");
    } finally {
      setLoading(false);
    }
  };

  const visibleDetections = useMemo(() => {
    if (!activeResult) return [];
    return activeResult.detections.filter(
      (d) =>
        d.confidence >= displayConf && !hiddenClasses.has(d.class_name),
    );
  }, [activeResult, displayConf, hiddenClasses]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    visibleDetections.forEach((d) => {
      c[d.class_name] = (c[d.class_name] ?? 0) + 1;
    });
    return c;
  }, [visibleDetections]);

  const allClassNames = useMemo(() => {
    const s = new Set<string>();
    activeResult?.detections.forEach((d) => s.add(d.class_name));
    return Array.from(s).sort();
  }, [activeResult]);

  // Stabil antar-render agar viewer tidak me-reset / memicu efek fokus ulang.
  // Di atas batas, hanya 100 teratas (keyakinan) yang digambar — ID tetap
  // indeks asli agar sinkron dengan baris tabel.
  const overlayBoxes: OverlayBox[] = useMemo(() => {
    if (loading || !activeResult) return [];
    const indexed = visibleDetections.map((det, idx) => ({ det, idx }));
    const capped =
      indexed.length > MAX_OVERLAY_BOXES
        ? [...indexed]
            .sort((a, b) => b.det.confidence - a.det.confidence)
            .slice(0, MAX_OVERLAY_BOXES)
        : indexed;
    return capped.map(({ det, idx }) => {
      const { x1, y1, x2, y2 } = det.bbox;
      return {
        id: `det-${idx}`,
        x1,
        y1,
        x2,
        y2,
        color: classColor(det.class_name),
        label: `${det.class_name} · ${(det.confidence * 100).toFixed(0)}%`,
      };
    });
  }, [loading, activeResult, visibleDetections]);
  const overlayCapped = visibleDetections.length > MAX_OVERLAY_BOXES;

  const modelLabel = (id: string) =>
    models.find((m) => m.id === id)?.display ?? id;
  const activeModelLabel = activeResult
    ? (activeResult.model_display ??
      (activeResult.model_id ? modelLabel(activeResult.model_id) : null) ??
      activeResult.model_version)
    : "";
  const compareModelLabel = compareResult
    ? (compareResult.model_display ??
      (compareResult.model_id ? modelLabel(compareResult.model_id) : null) ??
      compareResult.model_version)
    : compareModel
      ? modelLabel(compareModel)
      : "";

  // Deteksi model B pada ambang tampilan yang sama dengan model A.
  const compareVisible = useMemo(() => {
    if (!compareResult) return [];
    return compareResult.detections.filter((d) => d.confidence >= displayConf);
  }, [compareResult, displayConf]);

  const compareBoxes: OverlayBox[] = useMemo(
    () =>
      compareVisible.map((det, idx) => ({
        id: `cmp-${idx}`,
        x1: det.bbox.x1,
        y1: det.bbox.y1,
        x2: det.bbox.x2,
        y2: det.bbox.y2,
        color: classColor(det.class_name),
        label: `${det.class_name} · ${(det.confidence * 100).toFixed(0)}%`,
      })),
    [compareVisible],
  );

  // Selisih A vs B: cocok bila kelas sama & IoU >= 0.5.
  const diff = useMemo(() => {
    if (!compareResult) return null;
    const m = matchDetections(visibleDetections, compareVisible);
    return {
      ...m,
      onlyAGroup: groupCounts(m.onlyA),
      onlyBGroup: groupCounts(m.onlyB),
    };
  }, [compareResult, visibleDetections, compareVisible]);

  const toggleClass = (name: string) => {
    setHiddenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExport = (fmt: "json" | "csv") => {
    if (!activeResult || !activeFile) return;
    const base = activeFile.name.replace(/\.[^.]+$/, "");
    if (fmt === "json") {
      downloadJSON(`${base}-hasil.json`, {
        image: activeFile.name,
        model: activeResult.model_version,
        inference_ms: activeResult.inference_ms,
        detections: activeResult.detections,
      });
    } else {
      downloadCSV(`${base}-hasil.csv`, activeResult, activeFile.name);
    }
    notify("success", `Diekspor sebagai ${fmt.toUpperCase()}.`);
  };

  const handleDownloadImage = async () => {
    if (!activeResult || !activeFile) return;
    try {
      const size =
        naturalSize ?? (await getImageSize(activeFile)) ?? { w: 0, h: 0 };
      if (!size.w) {
        notify("error", "Ukuran gambar tidak terbaca.");
        return;
      }
      const base = activeFile.name.replace(/\.[^.]+$/, "");
      await downloadAnnotatedImage(
        activeFile,
        visibleDetections,
        size.w,
        size.h,
        `${base}-anotasi.png`,
        2048,
      );
      notify("success", "Gambar teranotasi diunduh (maks 2048px).");
    } catch {
      notify("error", "Gagal mengunduh gambar teranotasi.");
    }
  };

  const handlePrint = async () => {
    if (!activeResult || !activeFile || !activePreview) return;
    // Gambar teranotasi agar laporan berdiri sendiri tanpa aplikasi.
    let annotated = activePreview;
    try {
      const size =
        naturalSize ?? (await getImageSize(activeFile)) ?? { w: 0, h: 0 };
      if (size.w > 0) {
        const thumb = await makeThumbnailWithBoxes(
          activeFile,
          visibleDetections,
          size.w,
          size.h,
          900,
        );
        if (thumb) annotated = thumb;
      }
    } catch {
      // fallback ke pratinjau mentah
    }
    printReport({
      title: "Laporan Inspeksi PCB",
      imageName: activeFile.name,
      modelVersion: activeModelLabel || activeResult.model_version,
      inferenceMs: activeResult.inference_ms,
      imageUrl: annotated,
      detections: visibleDetections,
      threshold: displayConf,
      sensitivityLabel: sensitivityLabelFor(displayConf),
      source: demo ? "demo" : "live",
      imageWidth: naturalSize?.w,
      imageHeight: naturalSize?.h,
      generatedAt: new Date(),
    });
  };

  return (
    <>
      <SiteHeaderSimple />
      <Toaster />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6">
        {/* Judul */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Inspeksi PCB
              {demo && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 align-middle font-mono text-[12px] font-medium normal-case tracking-normal text-amber-700">
                  Mode demo
                </span>
              )}
            </h1>
            <p className="mt-1 max-w-xl text-ink-muted-80">
              {demo ? (
                <>
                  Hasil rekaman tanpa backend — untuk presentasi.{" "}
                  <button
                    type="button"
                    onClick={exitDemoMode}
                    className="font-medium text-primary hover:underline"
                  >
                    Keluar demo
                  </button>
                </>
              ) : (
                "Unggah satu atau banyak gambar, jalankan deteksi, dan tinjau hasilnya — dengan zoom, ambang keyakinan, dan ekspor."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {demo ? (
              <div
                className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-[13px] font-medium text-amber-700"
                role="status"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Mode demo — tanpa backend
              </div>
            ) : (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${
                backend === "online"
                  ? "bg-green-500/10 text-green-700"
                  : backend === "offline"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-canvas-parchment text-ink-muted-48"
              }`}
              role="status"
              aria-live="polite"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backend === "online"
                    ? "bg-green-500"
                    : backend === "offline"
                      ? "bg-red-500"
                      : "animate-pulse bg-ink-muted-48"
                }`}
              />
              {backend === "online"
                ? "Backend terhubung"
                : backend === "offline"
                  ? "Backend offline"
                  : "Menghubungi…"}
            </div>
            )}
            {backend === "offline" && (
              <button
                type="button"
                onClick={refreshBackend}
                className="pressable rounded-full border border-hairline px-3 py-1 text-[13px] font-medium text-ink transition-colors hover:bg-canvas-parchment"
              >
                Coba lagi
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:grid lg:grid-cols-[340px_1fr]">
          {/* === Panel input === */}
          <aside className="h-fit rounded-[18px] border border-hairline bg-canvas p-6 max-lg:order-2 lg:sticky lg:top-16">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted-48">
              Input
            </h2>

            {/* Pilih model */}
            {models.length > 0 && (
              <div className="mt-4">
                <label
                  htmlFor="model-select"
                  className="text-[13px] font-medium text-ink"
                >
                  Model
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-1 w-full rounded-full border border-hairline bg-canvas-parchment px-4 py-2 text-[14px] text-ink outline-none transition-colors focus:border-primary-focus"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-muted-48">
                  Pilih model untuk membandingkan hasil deteksi.
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/bmp"
              multiple
              onChange={handleFileChange}
              className="sr-only"
              id="pcb-file-input"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="sr-only"
              id="pcb-camera-input"
            />

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-[11px] border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-hairline bg-canvas-parchment hover:border-ink-muted-48"
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-muted-48 shadow-sm">
                <UploadIcon width={22} height={22} />
              </span>
              <span className="text-[15px] font-medium text-ink">
                Pilih atau seret gambar
              </span>
              <span className="text-[13px] text-ink-muted-48">
                JPG, PNG, atau BMP — bisa banyak
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 [@media(pointer:coarse)]:grid-cols-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="pressable rounded-full bg-primary px-3 py-2 text-[14px] text-white transition-colors hover:bg-primary-focus"
              >
                Pilih file
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                title="Membuka kamera di ponsel."
                className="pressable hidden items-center justify-center gap-1.5 rounded-full border border-hairline px-3 py-2 text-[14px] text-ink transition-colors hover:bg-canvas-parchment [@media(pointer:coarse)]:inline-flex"
              >
                <CameraIcon width={15} height={15} />
                Kamera
              </button>
            </div>
            <p className="mt-1.5 hidden text-center text-[11px] text-ink-muted-48 [@media(pointer:coarse)]:block">
              Tombol kamera membuka kamera langsung di ponsel.
            </p>

            {/* Daftar file antrean */}
            {files.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-muted-48">
                  Antrean ({files.length})
                </p>
                <ul className="max-h-56 space-y-1.5 overflow-auto pr-0.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveIdx(i);
                          setNaturalSize(null);
                          setSaveState("idle");
                          setHoveredId(null);
                          setCompareResult(null);
                        }}
                        aria-current={i === activeIdx ? "true" : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[11px] border px-2 py-1.5 text-left text-[13px] transition-colors ${
                          i === activeIdx
                            ? "border-primary/30 bg-primary/5 font-medium text-ink"
                            : "border-transparent text-ink-muted-80 hover:bg-canvas-parchment/60"
                        }`}
                      >
                        {previews[i] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previews[i] as string}
                            alt=""
                            aria-hidden
                            className="h-9 w-9 shrink-0 rounded-md border border-hairline object-cover"
                          />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-md bg-canvas-parchment" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{f.name}</span>
                          <span className="block font-mono text-[11px] text-ink-muted-48">
                            {(f.size / 1024).toFixed(0)} KB
                            {results[i]
                              ? ` · ${results[i]?.detections.length ?? 0} deteksi`
                              : loading && i === activeIdx
                                ? " · memproses…"
                                : " · belum dianalisis"}
                          </span>
                        </span>
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            results[i] ? "bg-green-500" : "bg-ink-muted-48"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        aria-label={`Hapus ${f.name}`}
                        className="shrink-0 rounded-full p-1.5 text-ink-muted-48 transition-colors hover:bg-red-500/10 hover:text-red-600"
                      >
                        <TrashIcon width={13} height={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={handleAnalyzeAll}
              disabled={files.length === 0 || loading}
              className="pressable mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-[16px] text-white transition-colors hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
            >
              {loading ? (
                <>
                  <LoaderIcon width={16} height={16} className="animate-spin" />
                  Memproses {activeIdx + 1}/{files.length}…
                </>
              ) : (
                <>
                  <ScanIcon width={16} height={16} />
                  Analisis {files.length > 1 ? `${files.length} gambar` : "gambar"}
                </>
              )}
            </button>

            {/* Sensitivitas — preset + slider fine-tune */}
            {files.length > 0 && (
              <div className="mt-5 rounded-[11px] border border-hairline p-3">
                <div className="flex items-center justify-between">
                  <label
                    id="sens-label"
                    className="text-[13px] font-medium text-ink"
                  >
                    Sensitivitas
                  </label>
                  <span
                    className="rounded-full bg-canvas-parchment px-2 py-0.5 font-mono text-[13px] text-ink-muted-80"
                    aria-live="polite"
                  >
                    {Math.round((activeResult ? displayConf : requestConf) * 100)}%
                  </span>
                </div>
                <div
                  role="group"
                  aria-labelledby="sens-label"
                  className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-canvas-parchment p-1"
                >
                  {SENS_PRESETS.map((p) => {
                    const cur = activeResult ? displayConf : requestConf;
                    const isActive = Math.abs(cur - p.value) < 0.001;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setRequestConf(p.value);
                          if (activeResult) setDisplayConf(p.value);
                        }}
                        aria-pressed={isActive}
                        title={p.hint}
                        className={`pressable rounded-full px-2 py-1.5 text-[12px] font-medium transition-colors ${
                          isActive
                            ? "bg-canvas text-ink shadow-sm"
                            : "text-ink-muted-48 hover:text-ink"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="sens"
                  type="range"
                  min={5}
                  max={90}
                  aria-label="Ambang keyakinan (persen)"
                  value={Math.round(
                    (activeResult ? displayConf : requestConf) * 100,
                  )}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    // Satu nilai untuk keduanya: menggeser langsung memfilter
                    // tampilan, dan nilai yang sama dipakai analisis berikutnya.
                    if (activeResult) setDisplayConf(v);
                    setRequestConf(v);
                  }}
                  className="mt-2 w-full accent-[#0066cc]"
                  aria-describedby="sens-help"
                />
                <p
                  id="sens-help"
                  className="mt-1 text-[11px] leading-snug text-ink-muted-48"
                >
                  {(() => {
                    const cur = activeResult ? displayConf : requestConf;
                    const hit = SENS_PRESETS.find(
                      (p) => Math.abs(cur - p.value) < 0.001,
                    );
                    if (hit) return hit.hint;
                    return activeResult
                      ? "Kustom — menggeser memfilter tampilan seketika. Nilai yang sama dipakai saat analisis berikutnya."
                      : "Kustom — ambang yang dikirim ke model saat analisis. Lebih rendah = lebih sensitif.";
                  })()}
                </p>
              </div>
            )}

            {/* Toggle kelas */}
            {activeResult && allClassNames.length > 0 && (
              <fieldset className="mt-5 space-y-1.5 border-t border-hairline pt-4">
                <legend className="px-1 text-[13px] font-medium text-ink">
                  Tampilkan kelas
                </legend>
                {allClassNames.map((name) => {
                  const color = classColor(name);
                  const on = !hiddenClasses.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleClass(name)}
                      aria-pressed={on}
                      className="flex w-full items-center justify-between rounded-[11px] px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-canvas-parchment"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: on ? color : "#d2d2d7",
                          }}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span
                            className="block truncate font-mono"
                            style={{ color: on ? undefined : "#7a7a7a" }}
                          >
                            {name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-muted-48">
                            {classDesc(name)}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          on
                            ? "bg-green-500/10 text-green-700"
                            : "bg-canvas-parchment text-ink-muted-48"
                        }`}
                      >
                        {on ? "Tampil" : "Sembunyi"}
                      </span>
                    </button>
                  );
                })}
              </fieldset>
            )}

            {saveState === "saving" && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-muted-48">
                <LoaderIcon width={14} height={14} className="animate-spin" />
                Menyimpan ke riwayat…
              </p>
            )}
            {saveState === "saved" && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-green-700">
                <CheckIcon width={14} height={14} />
                Tersimpan ke riwayat.
              </p>
            )}
            {saveState === "not-logged-in" && (
              <p className="mt-3 text-[13px] text-ink-muted-48">
                Hasil tidak disimpan — masuk akun untuk menyimpan riwayat.
              </p>
            )}
            {saveState === "skipped-non-pcb" && (
              <p className="mt-3 text-[13px] text-amber-700">
                Tidak disimpan ke riwayat — gambar tampaknya bukan PCB.
              </p>
            )}

            <div className="mt-5 space-y-1.5 border-t border-hairline pt-4 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted-48">Model</span>
                {health ? (
                  <span className="font-mono font-medium text-ink-muted-80">
                    {health.model}
                  </span>
                ) : (
                  <span className="text-ink-muted-48">
                    {backend === "offline" ? "tidak tersedia" : "…"}
                  </span>
                )}
              </div>
              {backend === "offline" && (
                <div className="mt-2 flex items-start gap-2 rounded-[11px] bg-red-500/5 px-3 py-2 text-red-600">
                  <AlertIcon width={13} height={13} className="mt-0.5 shrink-0" />
                  <span>
                    Pastikan backend berjalan di{" "}
                    <code className="font-mono">{API_BASE}</code>
                  </span>
                </div>
              )}
            </div>
          </aside>

          {/* === Panel hasil === */}
          <section className="min-w-0 max-lg:order-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <h2 className="flex shrink-0 items-center gap-2 whitespace-nowrap pt-1.5 text-[13px] font-semibold uppercase tracking-wide text-ink-muted-48">
                Hasil deteksi
                {activeResult && !loading && visibleDetections.length > 0 && (
                  <span className="rounded-full bg-canvas-parchment px-2 py-0.5 font-mono normal-case text-[12px] text-ink-muted-80">
                    {visibleDetections.length} cacat
                  </span>
                )}
                {activeResult && !loading && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[12px] font-medium normal-case tracking-normal ${
                      demo
                        ? "bg-amber-500/15 text-amber-700"
                        : "bg-green-500/10 text-green-700"
                    }`}
                    title={
                      demo
                        ? "Hasil dari rekaman presentasi, bukan inferensi live"
                        : "Hasil inferensi backend secara langsung"
                    }
                  >
                    {demo ? "Data demo" : "Live"}
                  </span>
                )}
              </h2>
              {activeResult && !loading && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    title="Unduh gambar dengan bbox permanen (maks 2048px)"
                    className="pressable inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-primary-focus"
                  >
                    <DownloadIcon width={13} height={13} />
                    Gambar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("json")}
                    className="pressable inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-[13px] text-primary transition-colors hover:bg-primary/5"
                  >
                    <DownloadIcon width={13} height={13} />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="pressable hidden rounded-full border border-hairline px-3 py-1.5 text-[13px] text-primary transition-colors hover:bg-primary/5 sm:inline-flex"
                  >
                    <DownloadIcon width={13} height={13} />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="pressable hidden rounded-full border border-hairline px-3 py-1.5 text-[13px] text-primary transition-colors hover:bg-primary/5 sm:inline-flex"
                  >
                    <PrinterIcon width={13} height={13} />
                    Cetak
                  </button>
                  {models.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompareOpen((v) => {
                          if (v) setCompareResult(null);
                          else if (!compareModel) {
                            const other = models.find(
                              (m) => m.id !== selectedModel,
                            );
                            if (other) setCompareModel(other.id);
                          }
                          return !v;
                        });
                      }}
                      aria-pressed={compareOpen}
                      title="Bandingkan dua model pada gambar ini"
                      className={`pressable inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                        compareOpen
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-hairline text-primary hover:bg-primary/5"
                      }`}
                    >
                      <ScanIcon width={13} height={13} />
                      Banding
                    </button>
                  )}
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={resetAll}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-ink-muted-48 transition-colors hover:bg-canvas-parchment hover:text-ink"
                    >
                      <RefreshIcon width={13} height={13} />
                      Baru
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Aksi sekunder di mobile */}
            {activeResult && !loading && (
              <div className="mt-2 flex items-center gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-[13px] text-primary"
                >
                  <DownloadIcon width={13} height={13} />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-[13px] text-primary"
                >
                  <PrinterIcon width={13} height={13} />
                  Cetak
                </button>
              </div>
            )}

            {files.length === 0 ? (
              /* Empty state */
              <div className="animate-fade-up mt-4 flex min-h-[480px] flex-col items-center justify-center rounded-[18px] border border-dashed border-hairline bg-canvas p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-parchment text-ink-muted-48">
                  <ImageIcon width={26} height={26} />
                </span>
                <p className="mt-4 text-[17px] font-medium text-ink">
                  Belum ada gambar
                </p>
                <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-ink-muted-48">
                  Pilih satu atau beberapa gambar PCB. Deteksi akan tampil di
                  sini dengan bounding box yang bisa di-zoom, difokuskan dari
                  tabel, dan diunduh sebagai gambar.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="pressable rounded-full bg-primary px-5 py-2.5 text-[15px] text-white transition-colors hover:bg-primary-focus"
                  >
                    Pilih gambar
                  </button>
                  <span className="text-[13px] text-ink-muted-48">
                    atau seret ke panel Input
                  </span>
                </div>
                {/* Gambar contoh — sekali klik langsung dianalisis */}
                <div className="mt-6 w-full max-w-md">
                  <p className="text-[13px] font-medium text-ink-muted-80">
                    Belum punya gambar? Coba contoh:
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-left">
                    {SAMPLES.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => loadSample(s)}
                        disabled={loading || !!sampleLoading}
                        className="pressable group overflow-hidden rounded-[14px] border border-hairline bg-canvas transition-colors hover:border-primary-focus disabled:cursor-wait disabled:opacity-70"
                      >
                        <span className="relative block aspect-[16/10] overflow-hidden bg-surface-tile-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.url}
                            alt={`Contoh PCB: ${s.label}`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                          />
                          {sampleLoading === s.name && (
                            <span className="absolute inset-0 flex items-center justify-center bg-surface-tile-1/60">
                              <LoaderIcon
                                width={20}
                                height={20}
                                className="animate-spin text-body-on-dark"
                              />
                            </span>
                          )}
                        </span>
                        <span className="block px-3 py-2">
                          <span className="block text-[13px] font-medium text-ink">
                            {s.label}
                          </span>
                          <span className="block text-[12px] text-ink-muted-48">
                            {sampleLoading === s.name
                              ? "Memuat & menganalisis…"
                              : `${s.desc} — klik untuk analisis`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : !activePreview ? (
              <div className="mt-4 flex min-h-[480px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-hairline bg-canvas text-ink-muted-48">
                <LoaderIcon width={20} height={20} className="animate-spin" />
                Memuat gambar…
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[18px] border border-hairline bg-canvas">
                {/* Peringatan bukan-PCB */}
                {activeResult && !loading && isNonPcb(activeResult) && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-5 py-3"
                  >
                    <AlertIcon
                      width={17}
                      height={17}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />
                    <div className="min-w-0 flex-1 text-[14px]">
                      <p className="font-medium text-amber-800">
                        Gambar ini tampaknya bukan PCB{" "}
                        <span className="font-mono text-[13px] font-normal">
                          (skor {(activeResult.pcb_score ?? 0).toFixed(2)} —
                          batas {PCB_SCORE_MIN.toFixed(2)})
                        </span>
                      </p>
                      <p className="mt-0.5 leading-snug text-amber-800/80">
                        {isAcked(activeFile)
                          ? "Anda menandai ini sebagai PCB — hasil di bawah ditampilkan dan analisis berikutnya akan disimpan."
                          : "Model hanya dilatih untuk papan sirkuit, sehingga “temuan” di bawah tidak valid dan tidak disimpan ke riwayat. Jika ini memang PCB (mis. soldermask biru/hitam), tandai manual."}
                      </p>
                      {!isAcked(activeFile) && activeFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setPcbAckKey(fileKey(activeFile));
                            setSaveState("idle");
                            notify(
                              "success",
                              "Ditandai sebagai PCB — analisis berikutnya akan disimpan.",
                            );
                          }}
                          className="pressable mt-2 rounded-full border border-amber-700/40 px-3.5 py-1.5 text-[13px] font-medium text-amber-800 transition-colors hover:bg-amber-500/15"
                        >
                          Ini PCB — tetap simpan
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Bar info */}
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
                  <span className="truncate font-mono text-[12px] text-ink-muted-48">
                    {activeFile?.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-4">
                    {activeResult && (
                      <span className="font-mono text-[12px] text-ink-muted-48">
                        {activeResult.inference_ms.toFixed(0)} ms
                      </span>
                    )}
                    {activeResult && naturalSize && (
                      <span className="hidden font-mono text-[12px] text-ink-muted-48 sm:inline">
                        {naturalSize.w}×{naturalSize.h}
                      </span>
                    )}
                  </div>
                </div>

                {/* Panel banding dua model */}
                {compareOpen && activeResult && !loading && (
                  <div className="animate-fade-up border-b border-hairline bg-canvas-parchment/50 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="max-w-[180px] truncate rounded-full bg-canvas px-3 py-1.5 font-mono text-[12px] text-ink-muted-80">
                        A · {activeModelLabel}
                      </span>
                      <span className="text-[13px] text-ink-muted-48">vs</span>
                      <select
                        value={compareModel}
                        onChange={(e) => {
                          setCompareModel(e.target.value);
                          setCompareResult(null);
                        }}
                        aria-label="Model pembanding"
                        className="max-w-[220px] rounded-full border border-hairline bg-canvas px-3 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-primary-focus"
                      >
                        {models
                          .filter((m) => m.id !== selectedModel)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              B · {m.display}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={runCompare}
                        disabled={comparing || !compareModel}
                        className="pressable inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[13px] text-white transition-colors hover:bg-primary-focus disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {comparing && (
                          <LoaderIcon
                            width={13}
                            height={13}
                            className="animate-spin"
                          />
                        )}
                        {comparing
                          ? "Membandingkan…"
                          : compareResult
                            ? "Bandingkan ulang"
                            : "Jalankan banding"}
                      </button>
                      <span className="w-full text-[12px] text-ink-muted-48">
                        Ambang sama ({Math.round(requestConf * 100)}%) ·
                        yang tersimpan ke riwayat: model A.
                      </span>
                    </div>
                  </div>
                )}

                {/* Viewer */}
                <div
                  className={
                    compareResult
                      ? "grid bg-surface-tile-1 md:grid-cols-2"
                      : "h-[420px] bg-surface-tile-1 sm:h-[560px]"
                  }
                >
                  {naturalSize ? (
                    compareResult ? (
                      <>
                        <div className="border-b border-white/10 md:border-b-0 md:border-r">
                          <p className="truncate bg-surface-tile-2 px-4 py-1.5 font-mono text-[12px] text-body-on-dark">
                            A · {activeModelLabel} ·{" "}
                            {visibleDetections.length} deteksi ·{" "}
                            {activeResult!.inference_ms.toFixed(0)} ms
                          </p>
                          <div className="h-[300px] sm:h-[420px]">
                            <ZoomableViewer
                              key={`${activePreview}-a`}
                              src={activePreview!}
                              alt="Gambar PCB hasil model A"
                              naturalWidth={naturalSize.w}
                              naturalHeight={naturalSize.h}
                              highlightId={hoveredId}
                              focusRequest={focusRequest}
                              onBoxHover={setHoveredId}
                              onBoxClick={setHoveredId}
                              boxes={overlayBoxes}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="truncate bg-surface-tile-2 px-4 py-1.5 font-mono text-[12px] text-body-on-dark">
                            B · {compareModelLabel} ·{" "}
                            {compareVisible.length} deteksi ·{" "}
                            {compareResult.inference_ms.toFixed(0)} ms
                          </p>
                          <div className="h-[300px] sm:h-[420px]">
                            <ZoomableViewer
                              key={`${activePreview}-b`}
                              src={activePreview!}
                              alt="Gambar PCB hasil model B"
                              naturalWidth={naturalSize.w}
                              naturalHeight={naturalSize.h}
                              highlightId={compareHoveredId}
                              onBoxHover={setCompareHoveredId}
                              boxes={compareBoxes}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                    <ZoomableViewer
                      key={activePreview}
                      src={activePreview}
                      alt="Gambar PCB dengan bounding box hasil deteksi"
                      naturalWidth={naturalSize.w}
                      naturalHeight={naturalSize.h}
                      highlightId={hoveredId}
                      focusRequest={focusRequest}
                      onBoxHover={setHoveredId}
                      onBoxClick={setHoveredId}
                      boxes={overlayBoxes}
                    >
                      {loading && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface-tile-1/70">
                          <span className="flex items-center gap-2 rounded-full bg-surface-tile-2 px-4 py-2 text-[15px] font-medium text-body-on-dark">
                            <LoaderIcon width={15} height={15} className="animate-spin" />
                            Menganalisis {activeFile?.name}…
                          </span>
                        </div>
                      )}
                    </ZoomableViewer>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activePreview}
                        alt="Gambar PCB"
                        className="hidden"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          setNaturalSize({
                            w: img.naturalWidth,
                            h: img.naturalHeight,
                          });
                        }}
                      />
                      <LoaderIcon width={20} height={20} className="animate-spin text-body-muted" />
                    </div>
                  )}
                </div>

                {/* Ringkasan + tabel */}
                {activeResult && !loading && (
                  <div className="animate-fade-up border-t border-hairline px-5 py-5">
                    {visibleDetections.length === 0 ? (
                      <div className="flex items-start gap-3 rounded-[11px] bg-canvas-parchment px-4 py-3">
                        <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-green-600" />
                        <div>
                          <p className="text-[15px] font-medium text-ink">
                            Tidak ada cacat terdeteksi
                          </p>
                          <p className="text-[13px] text-ink-muted-80">
                            {activeResult.detections.length > 0
                              ? "Semua deteksi tersaring oleh ambang/toggle tampilan."
                              : "Model tidak menemukan pola cacat di atas ambang keyakinan. Ini hanya mencakup 6 kelas yang dilatih — bukan pernyataan PCB aman."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Chips */}
                        <div className="flex flex-wrap items-center gap-2">
                          {Object.entries(counts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, count]) => {
                              const color = classColor(name);
                              return (
                                <span
                                  key={name}
                                  title={classDesc(name)}
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium"
                                  style={{
                                    color: "#1d1d1f",
                                    backgroundColor: hexToRgba(color, 0.22),
                                  }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: color }}
                                    aria-hidden
                                  />
                                  {name} ×{count}
                                </span>
                              );
                            })}
                          <span className="inline-flex items-center rounded-full bg-canvas-parchment px-3 py-1 text-[13px] font-medium text-ink-muted-80">
                            {visibleDetections.length} total ·{" "}
                            {activeResult.inference_ms.toFixed(0)} ms
                          </span>
                          {overlayCapped && (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-[13px] font-medium text-amber-700"
                              title="Hanya 100 box keyakinan tertinggi yang digambar agar viewer tetap ringan; tabel di bawah memuat semuanya."
                            >
                              100 box teratas digambar
                            </span>
                          )}
                        </div>

                        {/* Ringkasan selisih A vs B */}
                        {diff && (
                          <div className="animate-fade-up mt-3 rounded-[11px] border border-hairline p-3">
                            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted-48">
                              Selisih model · ambang {Math.round(displayConf * 100)}%
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-medium">
                              <span className="rounded-full bg-green-500/10 px-3 py-1 text-green-700">
                                Sama ×{diff.matched.length}
                              </span>
                              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                                Hanya A ×{diff.onlyA.length}
                              </span>
                              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-700">
                                Hanya B ×{diff.onlyB.length}
                              </span>
                            </div>
                            {diff.onlyAGroup.length > 0 && (
                              <p className="mt-2 font-mono text-[12px] text-ink-muted-80">
                                Hanya di A ({activeModelLabel}):{" "}
                                {diff.onlyAGroup
                                  .map(([n, c]) => `${n} ×${c}`)
                                  .join(" · ")}
                              </p>
                            )}
                            {diff.onlyBGroup.length > 0 && (
                              <p className="mt-1 font-mono text-[12px] text-ink-muted-80">
                                Hanya di B ({compareModelLabel}):{" "}
                                {diff.onlyBGroup
                                  .map(([n, c]) => `${n} ×${c}`)
                                  .join(" · ")}
                              </p>
                            )}
                            {diff.matched.length === visibleDetections.length &&
                              diff.onlyB.length === 0 && (
                                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-green-700">
                                  <CheckIcon width={14} height={14} />
                                  Kedua model sepakat penuh pada ambang ini.
                                </p>
                              )}
                          </div>
                        )}

                        <DetectionTable
                          detections={visibleDetections}
                          highlightId={hoveredId}
                          onHover={setHoveredId}
                          onFocusBox={(id) => {
                            setHoveredId(id);
                            focusTickRef.current += 1;
                            setFocusRequest({ id, n: focusTickRef.current });
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && !loading && (
              <div
                className="mt-4 flex items-start gap-3 rounded-[11px] border border-hairline bg-canvas px-4 py-3 text-[15px] text-ink"
                role="alert"
              >
                <AlertIcon width={18} height={18} className="mt-0.5 shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-600">Gagal memproses gambar</p>
                  <p className="mt-0.5 text-ink-muted-80">{error}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyzeAll}
                    className="pressable rounded-full bg-canvas-parchment px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-hairline"
                  >
                    Coba lagi
                  </button>
                  {!demo && backend === "offline" && (
                    <a
                      href="/inspect?demo=1"
                      className="pressable rounded-full border border-amber-700/40 px-3 py-1.5 text-center text-[13px] font-medium text-amber-800 transition-colors hover:bg-amber-500/15"
                      title="Lanjut presentasi dengan hasil rekaman tanpa backend"
                    >
                      Lanjut data demo
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
