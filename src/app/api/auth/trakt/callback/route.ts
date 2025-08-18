import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const code = url.searchParams.get("code");

	if (!code) {
		return NextResponse.json(
			{ error: "No authorization code provided" },
			{ status: 400 }
		);
	}

	try {
		const tokenResponse = await fetch("https://api.trakt.tv/oauth/token", {
			body: JSON.stringify({
				client_id: process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID,
				client_secret: process.env.NEXT_PUBLIC_TRAKT_CLIENT_SECRET,
				code,
				grant_type: "authorization_code",
				redirect_uri: process.env.NEXT_PUBLIC_TRAKT_REDIRECT_URI
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});
		const tokens = await tokenResponse.json();
		const response = NextResponse.redirect(new URL("/epg", req.url));

		response.cookies.set("trakt_access_token", tokens.access_token, {
			httpOnly: true,
			maxAge: tokens.expires_in || 3600,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production"
		});

		if (tokens.refresh_token) {
			response.cookies.set("trakt_refresh_token", tokens.refresh_token, {
				httpOnly: true,
				maxAge: 30 * 24 * 60 * 60,
				sameSite: "lax",
				secure: process.env.NODE_ENV === "production"
			});
		}

		return response;
	} catch (error) {
		console.error("OAuth error:", error);

		return NextResponse.json(
			{ error: "Authentication failed" },
			{ status: 500 }
		);
	}
}
