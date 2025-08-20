import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import traktRequest from "../lib/trakt";
import EPGClient from "./EPGClient";

const EPG = async () => {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("trakt_access_token")?.value;

	if (!accessToken) {
		redirect("/");
	}

	const [
		trendingMovies,
		popularMovies,
		boxOffice,
		mostPlayedMovies,
		trendingShows,
		recentlyWatchedMovies,
		recommendedMovies,
		recommendedShows
	] = await Promise.all([
		traktRequest("/movies/trending", { next: { revalidate: 300 } }),
		traktRequest("/movies/popular", { next: { revalidate: 300 } }),
		traktRequest("/movies/boxoffice", { next: { revalidate: 300 } }),
		traktRequest("/movies/played/weekly", { next: { revalidate: 300 } }),
		traktRequest("/shows/trending", { next: { revalidate: 300 } }),
		traktRequest("/users/me/history/movies", { cache: "no-store" }),
		traktRequest("/recommendations/movies", { cache: "no-store" }),
		traktRequest("/recommendations/shows", { cache: "no-store" })
	]);

	const initialData = [
		{ channelName: "Weekend Box Office", data: boxOffice, type: "movies" },
		{
			channelName: "Week's Most Played Movies",
			data: mostPlayedMovies,
			type: "movies"
		},
		{
			channelName: "Most Popular Movies",
			data: popularMovies,
			type: "movies"
		},
		{
			channelName: "Trending Movies 24 HRs",
			data: trendingMovies,
			type: "movies"
		},
		{
			channelName: "Trending Shows 24 HRs",
			data: trendingShows,
			type: "shows"
		},
		{
			channelName: "Recently Watched Movies",
			data: recentlyWatchedMovies,
			type: "movies"
		},
		{
			channelName: "Recommended Movies",
			data: recommendedMovies,
			type: "movies"
		},
		{
			channelName: "Recommended Shows",
			data: recommendedShows,
			type: "shows"
		}
	];

	return <EPGClient initialData={initialData} />;
};

export default EPG;
