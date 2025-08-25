import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	const { link, access_token } = await request.json();

	if (!link || !access_token) {
		return NextResponse.json(
			{ error: "Missing link or access_token" },
			{ status: 400 }
		);
	}

	try {
		const form = new URLSearchParams();

		form.append("link", link);

		const response = await fetch(
			"https://api.real-debrid.com/rest/1.0/unrestrict/link",
			{
				body: form,
				headers: {
					Authorization: `Bearer ${access_token}`,
					"Content-Type": "application/x-www-form-urlencoded"
				},
				method: "POST"
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
		console.error("RD unrestrict error:", error);

		return NextResponse.json(
			{ error: "Failed to unrestrict link" },
			{ status: 500 }
		);
	}
}
