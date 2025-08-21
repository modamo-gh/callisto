import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const base = process.env.SNOWFL_BASE_URL?.replace(/\/+$/, "");

	if (!base) {
		return NextResponse.json({ error: "Missing SNOWFL_BASE_URL" });
	}

	const prefix = url.searchParams.get("prefix") || process.env.SNOWFL_PREFIX || "";;
	const q = url.searchParams.get("q");
	const session =
		url.searchParams.get("session") ??
		randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
	const page = url.searchParams.get("page") ?? "0";
	const sort = url.searchParams.get("sort") ?? "NONE";
	const top = url.searchParams.get("top") ?? "NONE";
	const nsfw = url.searchParams.get("nsfw") ?? "1";

	if (!prefix || !q) {
		return NextResponse.json(
			{ error: "Missing prefix or q" },
			{ status: 400 }
		);
	}

	const full = `${base}/${prefix}/${encodeURIComponent(
		q
	)}/${session}/${page}/${sort}/${top}/${nsfw}`;

	const headers: Record<string, string> = {};

	if (process.env.SNOWFL_API_KEY) {
		headers["x-api-key"] = process.env.SNOWFL_API_KEY;
	}

	const r = await fetch(full, { headers: { cache: "no-store" } });
	const text = await r.text();

	if (!r.ok) {
		return new NextResponse(text, { status: r.status });
	}

	try {
		return NextResponse.json(JSON.parse(text), {
			headers: { "cache-control": "no-store" }
		});
	} catch {
		return NextResponse.json(
			{ payload: text },
			{ headers: { "cache-control": "no-store" } }
		);
	}
}
