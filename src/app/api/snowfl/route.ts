import { NextRequest, NextResponse } from "next/server";
import { Snowfl, Sort } from "snowfl-api";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const q = url.searchParams.get("q");

	if (!q) {
		return NextResponse.json(
			{ error: "Missing q parameter" },
			{ status: 400 }
		);
	}

	try {
		const snowfl = new Snowfl();
		const results = await snowfl.parse(q, {
			sort: Sort.MAX_SEED
		});

		return NextResponse.json(results, {
			headers: { "cache-control": "no-store" }
		});
	} catch (error: any) {
		console.error("Snowfl error:", error);

		return NextResponse.json(
			{
				error: "Failed to search Snowfl",
				details: error.message,
				status: error.response?.status || 500
			},
			{ status: error.response?.status || 500 }
		);
	}
}
