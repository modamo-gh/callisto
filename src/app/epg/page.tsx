import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import traktRequest from "../lib/trakt";
import EPGClient from "./EPGClient";

const EPG = async () => {
	const cookieStore = cookies();
	const accessToken = (await cookieStore).get("trakt_access_token");

	if (!accessToken) {
		redirect("/");
	}

	let trendingMovies;

	try {
		trendingMovies = await traktRequest("/movies/trending");
	} catch (error) {
		console.error("Error fetching Trakt data:", error);
	}

	return <EPGClient initialData={trendingMovies}/>
};

export default EPG;
