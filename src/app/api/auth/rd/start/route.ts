import getOrCreateSessionID from "@/app/lib/cookieSession";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	await getOrCreateSessionID();

	const url = new URL(req.url);
	const clientID =
		process.env.RD_CLIENT_ID || url.searchParams.get("client_id");

	if (!clientID) {
		return NextResponse.json(
			{ error: "Missing RD client_id" },
			{ status: 400 }
		);
	}

	const response = await fetch(
		`https://api.real-debrid.com/oauth/v2/device/code?client_id=${encodeURIComponent(
		  clientID
		)}&new_credentials=yes`,
		{ method: "GET" }
	  );

	if (!response.ok) {
		return new NextResponse(await response.text(), {
			status: response.status
		});
	}

	const data = await response.json();

	return NextResponse.json(data, {
		headers: { "cache-control": "no-store" }
	});
}
