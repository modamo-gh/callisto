import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	const { client_id, client_secret, device_code } = await req.json();

	if (!client_id || !client_secret || !device_code) {
		return NextResponse.json(
			{ error: "Missing client_id, client_secret, or device_code" },
			{ status: 400 }
		);
	}

	const form = new URLSearchParams({
		client_id,
		client_secret,
		code: device_code,
		grant_type: "http://oauth.net/grant_type/device/1.0"
	});
	const rd = await fetch("https://api.real-debrid.com/oauth/v2/token", {
		body: form.toString(),
		headers: { "content-type": "application/x-www-form-urlencoded" },
		method: "POST"
	});

    if (!rd.ok) {
		return new NextResponse(await rd.text(), { status: rd.status });
	}

	const data = await rd.json();

	return NextResponse.json(data, {
		headers: { "cache-control": "no-store" }
	});
}
