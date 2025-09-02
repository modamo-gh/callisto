import sessionStore from "@/app/lib/sessionStore";
import { Token } from "@/app/lib/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const code = url.searchParams.get("code");
	const sessionID = await (await cookies()).get("sessionID")?.value;

	if (!code || !sessionID) {
		return NextResponse.json(
			{ error: "Missing code or session" },
			{ status: 400 }
		);
	}

	const session = await sessionStore.get(sessionID);
	const verifier = session?.pkce_verifier;

	if (!verifier) {
		return NextResponse.json(
			{ error: "Missing PKCE verifier" },
			{ status: 400 }
		);
	}

	const response = await fetch("https://api.trakt.tv/oauth/token", {
		body: new URLSearchParams({
			client_id: process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID,
			client_secret: process.env.TRAKT_CLIENT_SECRET,
			code,
			code_verifier: verifier,
			grant_type: "authorization_code",
			redirect_uri: process.env.NEXT_PUBLIC_TRAKT_REDIRECT_URI
		}),
		headers: { "content-type": "application/x-www-form-urlencoded" },
		method: "POST"
	});

	if (!response.ok) {
		return NextResponse.json(
			{ error: await response.text() },
			{ status: response.status }
		);
	}

	const token = (await response.json()) as Token;

	await sessionStore.set(sessionID, {
		pkce_verifier: undefined,
		trakt: {
			access_token: token.access_token,
			expires_at: Date.now() + token.expires_in * 1000,
			refresh_token: token.refresh_token!
		}
	});

	return NextResponse.redirect(new URL("/epg", url.origin))
}
