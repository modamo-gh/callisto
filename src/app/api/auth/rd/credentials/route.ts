import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Credentials } from "@/app/lib/types";
import sessionStore from "@/app/lib/sessionStore";

export async function POST(req: NextRequest) {
	const jar = await cookies();
	const sessionID = jar.get("sessionID")?.value;

	if (!sessionID) {
		return NextResponse.json({ error: "No session" }, { status: 401 });
	}

	const { device_code } = await req.json();

	if (!device_code) {
		return NextResponse.json(
			{ error: "Missing device_code" },
			{ status: 400 }
		);
	}

	const clientID = process.env.RD_CLIENT_ID;

	if (!clientID) {
		return NextResponse.json(
			{ error: "Server missing RD_CLIENT_ID" },
			{ status: 400 }
		);
	}

	try {
		const response = await fetch(
			`https://api.real-debrid.com/oauth/v2/device/credentials?client_id=${encodeURIComponent(
				clientID
			)}&code=${encodeURIComponent(device_code)}`,
			{ headers: { accept: "application/json" } }
		);

		if (!response.ok) {
			return new NextResponse("pending", {
				headers: { "cache-control": "no-store" },
				status: 202
			});
		}

		const credentials = (await response.json()) as Credentials;

		await sessionStore.set(sessionID, {
			realDebridCredentials: credentials
		});

		return NextResponse.json(
			{ ok: true },
			{
				headers: { "cache-control": "no-store" }
			}
		);
	} catch (error) {
		return new NextResponse("pending", {
			status: 202,
			headers: { "cache-control": "no-store" }
		});
	}
}
