import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	const { client_id, client_secret, refresh_token } = await request.json();

	if (!refresh_token) {
		return NextResponse.json(
			{ error: "Missing refresh_token" },
			{ status: 400 }
		);
	}

	if (!client_id || !client_secret) {
		return NextResponse.json(
			{ error: "Missing client credentials" },
			{ status: 400 }
		);
	}

	const form = new URLSearchParams({
		client_id,
		client_secret,
		code: refresh_token,
		grant_type: "http://oauth.net/grant_type/device/1.0"
	});

	try {
		const response = await fetch(
			"https://api.real-debrid.com/oauth/v2/token",
			{
				body: form.toString(),
				headers: {
					"content-type": "application/x-www-form-urlencoded"
				},
				method: "POST"
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{
					error: "Failed to refresh token",
					message:
						response.status === 400
							? "Invalid refresh token"
							: "Refresh failed",
					status: response.status
				},
				{ status: response.status }
			);
		}

		const data = await response.json();

		return NextResponse.json(data, {
			headers: { "cache-control": "no-store" }
		});
	} catch (error) {
		console.error("RD token refresh error:", error);

		return NextResponse.json(
			{ error: "Token refresh failed" },
			{ status: 500 }
		);
	}
}
