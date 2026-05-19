import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "arrabon",
    status: "sprint-0-skeleton",
  });
}
