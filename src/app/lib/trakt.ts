import { cookies } from "next/headers";

const TRAKT_API_BASE = "https://api.trakt.tv";

const traktRequest = async (endpoint: string, options: RequestInit = {}) => {
	const cookieStore = cookies();
	const accessToken = (await cookieStore).get("trakt_access_token");

	if (!accessToken) {
		throw new Error("No Trakt access token found");
	}

	const response = await fetch(`${TRAKT_API_BASE}${endpoint}`, {
		...options,
		headers: {
			Authorization: `Bearer ${accessToken.value}`,
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