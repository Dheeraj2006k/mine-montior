import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200, source: "live" | "mock" = "live"): NextResponse {
  return NextResponse.json(
    { data, meta: { generated_at: new Date().toISOString(), source } },
    { status },
  );
}

export function fail(
  code: string,
  message: string,
  details: unknown[] = [],
  status = 400,
): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
