import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPartner, getPartnerPageData } from "@/lib/partners-data";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getPartnerPageData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  // Public endpoint — anyone can submit a partnership application.
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectName, contactEmail, websiteUrl, description } = body as Record<string, unknown>;

  if (
    typeof projectName !== "string" || !projectName.trim() ||
    typeof contactEmail !== "string" || !contactEmail.trim() ||
    typeof websiteUrl !== "string" || !websiteUrl.trim() ||
    typeof description !== "string" || !description.trim()
  ) {
    return NextResponse.json(
      { error: "projectName, contactEmail, websiteUrl, and description are required" },
      { status: 400 },
    );
  }

  const partner = await createPartner({
    projectName: projectName.trim(),
    contactEmail: contactEmail.trim(),
    websiteUrl: websiteUrl.trim(),
    description: description.trim(),
  });

  return NextResponse.json(partner, { status: 201 });
}
