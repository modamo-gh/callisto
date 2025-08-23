import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import traktRequest from "../lib/trakt";
import { Channels, Episode, Movie, Program } from "../lib/types";
import EPGClient from "./EPGClient";
import { randomUUID } from "crypto";

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
		trendingShows
		// recentlyWatchedMovies,
		// recommendedMovies,
		// recommendedShows,
		// recentlyWatchedEpisodes
	] = await Promise.all([
		traktRequest("/movies/trending", { next: { revalidate: 300 } }),
		traktRequest("/movies/popular", { next: { revalidate: 300 } }),
		traktRequest("/movies/boxoffice", { next: { revalidate: 300 } }),
		traktRequest("/movies/played/weekly", { next: { revalidate: 300 } }),
		traktRequest("/shows/trending", { next: { revalidate: 300 } })
		// traktRequest("/users/me/history/movies", { cache: "no-store" }),
		// traktRequest("/recommendations/movies", { cache: "no-store" }),
		// traktRequest("/recommendations/shows", { cache: "no-store" }),
		// traktRequest("/users/me/history/episodes", { cache: "no-store" })
	]);

	const formatProgram = (program): Program => {
		return program.show
			? ({
					id: randomUUID(),
					kind: "tv",
					title: program.show?.title,
					tmdb: program.show?.ids.tmdb
			  } as Episode)
			: ({
					id: randomUUID(),
					kind: "movie",
					title: program.title || program.movie?.title,
					tmdb: program.ids?.tmdb || program.movie?.ids.tmdb
			  } as Movie);
	};

	const channels: Channels = [
		{
			name: "Weekend Box Office",
			programs: boxOffice.map((program) => formatProgram(program))
		},
		{
			name: "Week's Most Played Movies",
			programs: mostPlayedMovies.map((program) => formatProgram(program))
		},
		{
			name: "Most Popular Movies",
			programs: popularMovies.map((program) => formatProgram(program))
		},
		{
			name: "Trending Movies 24 HRs",
			programs: trendingMovies.map((program) => formatProgram(program))
		},
		{
			name: "Trending Shows 24 HRs",
			programs: trendingShows.map((program) => formatProgram(program))
		}
		// 	{
		// 		name: "Recently Watched Movies",
		// 		programs: recentlyWatchedMovies
		// 	},
		// 	{
		// 		name: "Recommended Movies",
		// 		programs: recommendedMovies
		// 	},
		// 	{
		// 		name: "Recommended Shows",
		// 		programs: recommendedShows
		// 	},
		// 	{
		// 		name: "Recently Watched Episodes",
		// 		programs: recentlyWatchedEpisodes
		// 	}
	];

	return <EPGClient channels={channels} />;
};

export default EPG;
