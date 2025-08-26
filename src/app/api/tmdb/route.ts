import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const url = new URL(request.url);

	const episode = url.searchParams.get("episode");
	const id = url.searchParams.get("id");
	const season = url.searchParams.get("season");
	const type = url.searchParams.get("type");

	if (!id || !type) {
		return NextResponse.json(
			{ error: "Missing TMDB id or type" },
			{ status: 400 }
		);
	}

	if (!["movie", "tv"].includes(type)) {
		return NextResponse.json(
			{ error: "Type must be 'movie' or 'tv'" },
			{ status: 400 }
		);
	}

	let path = `https://api.themoviedb.org/3/${type}/${id}`;

	if (season) {
		path += `/season/${season}`;

		if (episode) {
			path += `/episode/${episode}`;
		}
	}

	try {
		const response = await fetch(
			`${path}?api_key=${process.env.TMDB_API_KEY}`
		);

		if (!response.ok) {
			const errorText = await response
				.text()
				.catch(() => "Unknown error");

			return NextResponse.json(
				{
					details: errorText,
					error: "TMDB API error",
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
		console.error("TMDB error", error);

		return NextResponse.json(
			{ error: "Failed to retrieve TMDB data" },
			{ status: 500 }
		);
	}
}
