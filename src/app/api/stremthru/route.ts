import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { hashes } = (await request.json()) as { hashes: string[] };

		if (!hashes.length) {
			return NextResponse.json({ error: "No hashes" }, { status: 400 });
		}

		const magnets = hashes
			.map((hash) => `magnet:?xt=urn:btih:${hash.trim()}`)
			.join(",");

		const url = `https://stremthru.13377001.xyz/v0/store/magnets/check?magnet=${encodeURIComponent(
			magnets
		)}`;

		const response = await fetch(url, {
			headers: {
				"X-StremThru-Store-Name": "realdebrid",
				"X-StremThru-Store-Authorization": `Bearer ${process.env.REALDEBRID_TOKEN}`
			},
			cache: "no-store"
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");

			return NextResponse.json(
				{ error: `StremThru ${response.status}`, details: body },
				{ status: 502 }
			);
		}

		const data = await response.json();

		return NextResponse.json(data);
	} catch (error) {
		return NextResponse.json(
			{ error: "Server error", details: error.message ?? String(error) },
			{ status: 500 }
		);
	}
}
