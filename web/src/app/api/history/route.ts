import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspection } from "@/lib/schema";
import { headers } from "next/headers";

const MAX_HISTORY = 10;

type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return session.user;
}

export async function GET() {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(inspection)
    .where(eq(inspection.userId, user.id))
    .orderBy(desc(inspection.createdAt))
    .limit(MAX_HISTORY);

  const items = rows.map((r) => ({
    id: r.id,
    imageName: r.imageName,
    modelVersion: r.modelVersion,
    inferenceMs: r.inferenceMs,
    defectCount: r.defectCount,
    detections: JSON.parse(r.detections) as Detection[],
    thumbnail: r.thumbnail,
    review: r.review ?? "",
    imageWidth: r.imageWidth,
    imageHeight: r.imageHeight,
    threshold: r.threshold,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    imageName?: string;
    modelVersion?: string;
    inferenceMs?: number;
    detections?: Detection[];
    thumbnail?: string;
    imageWidth?: number;
    imageHeight?: number;
    threshold?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.imageName || !body.modelVersion || body.detections === undefined) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Jaga agar maksimal MAX_HISTORY per user: buang yang paling lama bila penuh.
  const rows = await db
    .select({ id: inspection.id })
    .from(inspection)
    .where(eq(inspection.userId, user.id))
    .orderBy(desc(inspection.createdAt));

  if (rows.length >= MAX_HISTORY) {
    const toDelete = rows.slice(MAX_HISTORY - 1).map((r) => r.id);
    if (toDelete.length > 0) {
      await db.delete(inspection).where(inArray(inspection.id, toDelete));
    }
  }

  const [created] = await db
    .insert(inspection)
    .values({
      userId: user.id,
      imageName: body.imageName,
      modelVersion: body.modelVersion,
      inferenceMs: body.inferenceMs ?? 0,
      defectCount: body.detections.length,
      detections: JSON.stringify(body.detections),
      thumbnail: body.thumbnail ?? null,
      imageWidth:
        typeof body.imageWidth === "number" ? Math.round(body.imageWidth) : null,
      imageHeight:
        typeof body.imageHeight === "number"
          ? Math.round(body.imageHeight)
          : null,
      threshold: typeof body.threshold === "number" ? body.threshold : null,
    })
    .returning();

  return NextResponse.json(
    {
      id: created.id,
      imageName: created.imageName,
      createdAt: created.createdAt,
    },
    { status: 201 },
  );
}
