import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import traktRequest from "../lib/trakt";
import { Channel, Channels, Episode, Program, Show } from "../lib/types";
import EPGClient from "./EPGClient";

const EPG = async () => {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get("trakt_access_token")?.value;

	if (!accessToken) {
		redirect("/");
	}

	const [
		trendingMovies,
		// popularMovies,
		// boxOffice,
		// mostPlayedMovies,
		// trendingShows,
		// recentlyWatched,
		// recommendations
	] = await Promise.all([
		traktRequest("/movies/trending", { next: { revalidate: 300 } }),
		// traktRequest("/movies/popular", { next: { revalidate: 300 } }),
		// traktRequest("/movies/boxoffice", { next: { revalidate: 300 } }),
		// traktRequest("/movies/played/weekly", { next: { revalidate: 300 } }),
		// traktRequest("/shows/trending", { next: { revalidate: 300 } }),
		// traktRequest("/users/me/history/", { cache: "no-store" }),
		// traktRequest("/recommendations/", { cache: "no-store" })
	]);

	const formatProgram = (program): Episode | Program | Show => {
		if (program.ids?.tvdb || program.show?.ids?.tvdb) {
			const show: Show = {
				episodeTMDB: null,
				id: randomUUID(),
				kind: "tv",
				title: program?.title || program.show?.title,
				tmdb: program.ids?.tmdb || program.show?.ids.tmdb
			};

			if (program.episode) {
				const episode: Episode = {
					...show,
					episodeTitle: program.episode.title,
					episodeTMDB: program.episode.ids.tmdb,
					number: program.episode.number,
					kind: "episode",
					season: program.episode.season
				};

				return episode;
			}

			return show;
		} else {
			const movie: Program = {
				id: randomUUID(),
				kind: "movie",
				title: program.title || program.movie?.title,
				tmdb: program.ids?.tmdb || program.movie?.ids.tmdb
			};

			return movie;
		}
	};

	const shuffle = (h: Channels | (Episode | Program | Show)[]) => {
		const p = [...h];

		for (let i = p.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));

			[p[i], p[j]] = [p[j], p[i]];
		}

		return (h[0] as Channel).name ? (p as Channels) : (p as (Episode | Program | Show)[]);
	};

	const channels: Channels = shuffle([
		// {
		// 	name: "Weekend Box Office",
		// 	programs: shuffle(
		// 		boxOffice.map((program) => formatProgram(program))
		// 	)
		// },
		// {
		// 	name: "Week's Most Played Movies",
		// 	programs: shuffle(
		// 		mostPlayedMovies.map((program) => formatProgram(program))
		// 	)
		// },
		// {
		// 	name: "Most Popular Movies",
		// 	programs: shuffle(
		// 		popularMovies.map((program) => formatProgram(program))
		// 	)
		// },
		{
			name: "Trending Movies 24 HRs",
			programs: shuffle(
				trendingMovies.map((program) => formatProgram(program))
			)
		},
		// {
		// 	name: "Trending Shows 24 HRs",
		// 	programs: shuffle(
		// 		trendingShows.map((program) => formatProgram(program))
		// 	)
		// },
		// {
		// 	name: "Recently Watched",
		// 	programs: shuffle(
		// 		recentlyWatched.map((program) => formatProgram(program))
		// 	)
		// },
		// {
		// 	name: "Recommendations",
		// 	programs: shuffle(
		// 		recommendations.map((program) => formatProgram(program))
		// 	)
		// }
	]);

	return <EPGClient channels={channels} />;
};

export default EPG;
