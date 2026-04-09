import { NextResponse } from "next/server";

function getServerConfig() {
  const serverUrl = process.env.FLUID_SERVER_URL?.trim().replace(/\/$/, "");
  const adminToken = process.env.FLUID_ADMIN_TOKEN?.trim();

  if (!serverUrl || !adminToken) {
    throw new Error("FLUID_SERVER_URL and FLUID_ADMIN_TOKEN must be configured");
  }

  return { serverUrl, adminToken };
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ publicKey: string }> },
) {
  try {
    const { publicKey } = await context.params;
    const { serverUrl, adminToken } = getServerConfig();
    const response = await fetch(`${serverUrl}/admin/signers/${encodeURIComponent(publicKey)}`, {
      method: "DELETE",
      headers: {
        "x-admin-token": adminToken,
      },
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove signer",
      },
      { status: 500 },
    );
  }
}
