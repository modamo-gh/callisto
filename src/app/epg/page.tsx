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
	let trendingShows;

	try {
		trendingMovies = await traktRequest("/movies/trending");
		popularMovies = await traktRequest("/movies/popular");
		boxOffice = await traktRequest("/movies/boxoffice");
		mostPlayedMovies = await traktRequest("/movies/played/weekly");
		trendingShows = await traktRequest("/shows/trending");
	} catch (error) {
		console.error("Error fetching Trakt data:", error);
	}

	const initialData = [
		{ channelName: "Weekend Box Office", data: boxOffice, type: "movies" },
		{ channelName: "Week's Most Played Movies", data: mostPlayedMovies, type: "movies" },
		{ channelName: "Most Popular Movies", data: popularMovies, type: "movies" },
		{ channelName: "Trending Movies 24 HRs", data: trendingMovies, type: "movies" },
		{channelName: "Trending Shows 24 HRs", data: trendingShows, type: "shows"}
	];

	return <EPGClient initialData={initialData} />;
};

export default EPG;
