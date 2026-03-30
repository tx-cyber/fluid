import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deletePartner, updatePartnerStatus } from "@/lib/partners-data";
import type { PartnerStatus } from "@/components/dashboard/types";

const VALID_STATUSES: PartnerStatus[] = ["pending", "approved", "rejected"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, reviewNote } = body as Record<string, unknown>;

  if (!VALID_STATUSES.includes(status as PartnerStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await updatePartnerStatus(
    id,
    status as PartnerStatus,
    typeof reviewNote === "string" ? reviewNote : null,
  );

  if (!updated) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deletePartner(id);

  if (!deleted) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
