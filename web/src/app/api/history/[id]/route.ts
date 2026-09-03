import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspection } from "@/lib/schema";
import { headers } from "next/headers";

async function requireOwned(
  sessionUserId: string,
  id: string,
): Promise<boolean> {
  const owned = await db
    .select({ id: inspection.id })
    .from(inspection)
    .where(and(eq(inspection.id, id), eq(inspection.userId, sessionUserId)))
    .limit(1);
  return owned.length > 0;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!(await requireOwned(session.user.id, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(inspection).where(eq(inspection.id, id));
  return NextResponse.json({ ok: true });
}

/** Update status review (error analysis): 'tp' | 'fp' | 'miss' | ''. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await requireOwned(session.user.id, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { review?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const review = body.review ?? "";
  if (!["", "tp", "fp", "miss"].includes(review)) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  await db
    .update(inspection)
    .set({ review })
    .where(eq(inspection.id, id));

  return NextResponse.json({ ok: true });
}
