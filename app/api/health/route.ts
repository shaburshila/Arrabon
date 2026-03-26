import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "base-consult-link",
    status: "sprint-0-skeleton",
  });
}
