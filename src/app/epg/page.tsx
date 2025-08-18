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
	let popularMovies;
	let boxOffice;
	let mostPlayedMovies;

	try {
		trendingMovies = await traktRequest("/movies/trending");
		popularMovies = await traktRequest("/movies/popular");
		boxOffice = await traktRequest("/movies/boxoffice");
		mostPlayedMovies = await traktRequest("/movies/played/weekly");
	} catch (error) {
		console.error("Error fetching Trakt data:", error);
	}

	const initialData = [
		boxOffice,
		mostPlayedMovies,
		popularMovies,
		trendingMovies
	];

	return <EPGClient initialData={initialData} />;
};

export default EPG;
