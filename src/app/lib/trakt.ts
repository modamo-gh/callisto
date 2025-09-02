import { cookies } from "next/headers";
import sessionStore from "./sessionStore";

const TRAKT_API_BASE = "https://api.trakt.tv";

const traktRequest = async (endpoint: string, options: RequestInit = {}) => {
	const jar = await cookies();
	const sessionID = jar.get("sessionID")?.value;
	const session = sessionID ? await sessionStore.get(sessionID) : null;

	if (!session?.trakt?.access_token) {
		throw new Error("No Trakt access token found");
	}

	const response = await fetch(`${TRAKT_API_BASE}${endpoint}`, {
		...options,
		headers: {
			Authorization: `Bearer ${session?.trakt?.access_token}`,
			"Content-Type": "application/json",
			"trakt-api-version": "2",
			"trakt-api-key": process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID!,
			...options.headers
		}
	});

	if (!response.ok) {
		throw new Error(
			`Trakt API error: ${response.status} ${response.statusText}`
		);
	}

	return response.json();
};

export default traktRequest;