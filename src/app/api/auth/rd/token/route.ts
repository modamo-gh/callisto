import sessionStore from "@/app/lib/sessionStore";
import { Token } from "@/app/lib/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	const jar = await cookies();
	const sessionID = jar.get("sessionID")?.value;

	if (!sessionID) {
		return NextResponse.json({ error: "No session" }, { status: 401 });
	}

	const { device_code } = await req.json();

	if (!device_code) {
		return NextResponse.json(
			{ error: "Missing device_code" },
			{ status: 400 }
		);
	}

	const session = await sessionStore.get(sessionID);
	const credentials = session?.realDebridCredentials;

	if (!credentials?.client_id || !credentials.client_secret) {
		return NextResponse.json(
			{ error: "Missing RD credentials (approval not completed)" },
			{ status: 400 }
		);
	}

	const body = new URLSearchParams({
		client_id: credentials?.client_id,
		client_secret: credentials.client_secret,
		code: device_code,
		grant_type: "http://oauth.net/grant_type/device/1.0"
	});
	const response = await fetch("https://api.real-debrid.com/oauth/v2/token", {
		body,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		method: "POST"
	});

	if (!response.ok) {
		return new NextResponse(await response.text(), {
			status: response.status
		});
	}

	const token = (await response.json()) as Token;

	await sessionStore.set(sessionID, {
		realDebrid: {
			access_token: token.access_token,
			expires_at: Date.now() + token.expires_in * 1000,
			refresh_token: token.refresh_token!
		}
	});

	return NextResponse.json(
		{ ok: true },
		{ headers: { "cache-control": "no-store" } }
	);
}
