import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const q = url.searchParams.get("q");

	if (!q) {
		return NextResponse.json(
			{ error: "Missing search query" },
			{ status: 400 }
		);
	}

	try {
		const response = await fetch(
			`http://159.89.35.13:9696/api/v1/search?apikey=${process.env.PROWLARR_API_KEY}&query=${q}&type=search`
		);

		if (!response.ok) {
			const errorText = await response
				.text()
				.catch(() => "Unknown error");

			return NextResponse.json(
				{
					details: errorText,
					error: "Prowlarr API error",
					status: response.status
				},
				{ status: response.status }
			);
		}

		const data = await response.json();

		return NextResponse.json(data, {
			headers: {
				"cache-control": "public, max-age=3600"
			}
		});
	} catch (error) {
		console.error("Prowlarr error", error);

		return NextResponse.json(
			{ error: "Failed to retrieve Prowlarr data" },
			{ status: 500 }
		);
	}
}
