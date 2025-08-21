import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const clientID =
		process.env.RD_CLIENT_ID || url.searchParams.get("client_id");

	if (!clientID) {
		return NextResponse.json(
			{ error: "Missing RD client_id" },
			{ status: 400 }
		);
	}

	const rd = await fetch(
		`https://api.real-debrid.com/oauth/v2/device/code?client_id=${encodeURIComponent(
			clientID
		)}&new_credentials=yes`,
		{ method: "GET" }
	);

	if (!rd.ok) {
		return new NextResponse(await rd.text(), { status: rd.status });
	}

	const data = await rd.json();

	return NextResponse.json(data, {
		headers: { "cache-control": "no-store" }
	});
}
