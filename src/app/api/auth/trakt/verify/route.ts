import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
	const accessToken = req.cookies.get("trakt_access_token")?.value;

	if (!accessToken) {
		return NextResponse.json({ authenticated: false }, { status: 401 });
	}

	return NextResponse.json({ authenticated: true });
}
