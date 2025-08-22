import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	const { device_code } = await req.json();

	if (!device_code) {
		return NextResponse.json(
			{ error: "Missing device_code" },
			{ status: 400 }
		);
	}

	const clientID = process.env.RD_CLIENT_ID;

	if (!clientID) {
		return NextResponse.json(
			{ error: "Server missing RD_CLIENT_ID" },
			{ status: 400 }
		);
	}

	const rd = await fetch(
		`https://api.real-debrid.com/oauth/v2/device/credentials?client_id=${encodeURIComponent(
			clientID
		)}&code=${encodeURIComponent(device_code)}`
	);

	if (!rd.ok) {
		return new NextResponse(await rd.text(), { status: rd.status });
	}

	return NextResponse.json(await rd.json(), {
		headers: { "cache-control": "no-store" }
	});
}
