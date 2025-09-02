import getOrCreateSessionID from "@/app/lib/cookieSession";
import sessionStore from "@/app/lib/sessionStore";
import { NextResponse } from "next/server";

const b64URL = (buffer: ArrayBuffer) => {
	return Buffer.from(buffer)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
};

export async function GET() {
	const sessionID = await getOrCreateSessionID();
	const verifier = b64URL(crypto.getRandomValues(new Uint8Array(32)));
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier)
	);
	const challenge = b64URL(digest);

	await sessionStore.set(sessionID, { pkce_verifier: verifier });

	const params = new URLSearchParams({
		client_id: process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID,
		code_challenge: challenge,
		code_challenge_method: "S256",
		redirect_uri: process.env.NEXT_PUBLIC_TRAKT_REDIRECT_URI,
		response_type: "code"
	});

	return NextResponse.json({
		url: `https://trakt.tv/oauth/authorize?${params}`
	});
}
