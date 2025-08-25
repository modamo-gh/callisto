import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	const { hashes, access_token } = await request.json();

	if (!hashes || !access_token) {
		return NextResponse.json(
			{ error: "Missing hashes or access_token" },
			{ status: 400 }
		);
	}

	try {
		const response = await fetch(
			`https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${hashes.join(
				"/"
			)}`,
			{
				headers: {
					Authorization: `Bearer ${access_token}`
				}
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{ error: "RD API error" },
				{ status: response.status }
			);
		}

		const data = await response.json();

		return NextResponse.json(data);
	} catch (error) {
		console.error("RD instant availability error:", error);

		return NextResponse.json(
			{ error: "Failed to check availability" },
			{ status: 500 }
		);
	}
}
