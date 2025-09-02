import sessionStore from "@/app/lib/sessionStore";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
	const sessionID = (await cookies()).get("sessionID")?.value;
	const session = sessionID ? await sessionStore.get(sessionID) : null;

	return NextResponse.json({
		realDebridAuthed: !!session?.realDebrid?.access_token,
		traktAuthed: !!session?.trakt?.access_token
	});
}
