// app/api/rd/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { client_id, client_secret, refresh_token } = await request.json();

  if (!client_id || !client_secret || !refresh_token) {
    return NextResponse.json({ error: "Missing client_id, client_secret or refresh_token" }, { status: 400 });
  }

  const form = new URLSearchParams({
    client_id,
    client_secret,
    grant_type: "refresh_token",
    refresh_token
  });

  const resp = await fetch("https://api.real-debrid.com/oauth/v2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  const text = await resp.text();
  if (!resp.ok) {
    return NextResponse.json(
      { error: "Failed to refresh token", status: resp.status, details: text },
      { status: resp.status }
    );
  }
  return NextResponse.json(JSON.parse(text), { headers: { "cache-control": "no-store" } });
}
