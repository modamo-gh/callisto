import { cookies } from "next/headers";

const getOrCreateSessionID = async () => {
	const jar = await cookies();
	let sessionID = jar.get("sessionID")?.value;

	if (!sessionID) {
		sessionID = crypto.randomUUID();
		jar.set("sessionID", sessionID, {
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 7,
			path: "/",
			sameSite: "lax",
			secure: true
		});
	}

	return sessionID;
};

export default getOrCreateSessionID;
