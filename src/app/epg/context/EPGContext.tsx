import {
	Channel,
	EPGContextType,
	Episode,
	EpisodeMeta,
	Genre,
	Program,
	ProgramMeta,
	Show
} from "@/app/lib/types";
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState
} from "react";

const EPGContext = createContext<EPGContextType | undefined>(undefined);

export const EPGProvider: React.FC<{
	children: ReactNode;
	channels: Channel[];
}> = ({ channels, children }) => {
	const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
	const [episodeTMDBCache, setEpisodeTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [episodeMetaCache, setEpisodeMetaCache] = useState<
		Map<number, EpisodeMeta>
	>(new Map());
	const [movieMetaCache, setMovieMetaCache] = useState<
		Map<number, ProgramMeta>
	>(new Map());
	const [movieTMDBCache, setMovieTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [showTMDBCache, setShowTMDBCache] = useState<Map<number, any>>(
		new Map()
	);

	useEffect(() => {
		const preloadVisibleChannels = async () => {
			const viewableChannels = [
				channels[
					currentChannelIndex - 1 < 0
						? channels.length - 1
						: currentChannelIndex - 1
				],
				channels[currentChannelIndex],
				channels[(currentChannelIndex + 1) % channels.length]
			];

			for (const channel of viewableChannels) {
				for (let i = 0; i < channel.programs.length; i++) {
					const program = channel.programs[i];

					switch (program.kind) {
						case "movie":
							if (!movieMetaCache.has(program.tmdb)) {
								fetchMovieMeta(program);
							}

							break;
						case "episode":
							const episode = program as Episode;

							if (!episodeMetaCache.has(episode.episodeTMDB)) {
								fetchEpisodeMeta(episode);
							}

							break;
						case "tv":
							const show = program as Show;

							if (!showTMDBCache.has(program.tmdb)) {
								fetchShowTMDB(show)
									.then(() => {
										if (!show.episodeTMDB) {
											fetchEpisodeTMDB(show)
												.then((episodeTMDB) => {
													if (episodeTMDB) {
														show.episodeTMDB =
															episodeTMDB.id;
													}
												})
												.catch((error) =>
													console.error(
														"Error fetching episode TMDB:",
														error
													)
												);
										}
									})
									.catch((error) =>
										console.error(
											"Error fetching show meta:",
											error
										)
									);
							} else if (!show.episodeTMDB) {
								fetchEpisodeTMDB(show)
									.then((episodeTMDB) => {
										if (episodeTMDB) {
											show.episodeTMDB = episodeTMDB.id;
										}
									})
									.catch((error) =>
										console.error(
											"Error fetching episode TMDB:",
											error
										)
									);
							}

							break;
					}

					if (i === 0) {
						fetchProgramLink(program);
					}
				}
			}
		};

		preloadVisibleChannels();
	}, [currentChannelIndex]);

	const fetchShowTMDB = useCallback(
		async (show: Show) => {
			try {
				if (!show.tmdb) {
					return null;
				}

				let tmdbData;

				if (showTMDBCache.has(show.tmdb)) {
					return showTMDBCache.get(show.tmdb);
				} else {
					const response = await fetch(
						`/api/tmdb?id=${encodeURIComponent(show.tmdb)}&type=tv`
					);

					if (!response.ok) {
						throw new Error("Failed to fetch episode TMDB details");
					}

					tmdbData = await response.json();

					setShowTMDBCache((prev) => {
						const tmdbCache = new Map(prev);

						tmdbCache.set(show.tmdb, tmdbData);

						return tmdbCache;
					});

					return tmdbData;
				}
			} catch (error) {
				console.error("Error fetching episode TMDB details:", error);

				return null;
			}
		},
		[showTMDBCache]
	);

	const fetchEpisodeTMDB = useCallback(
		async (program: Episode | Show) => {
			try {
				if (program.kind === "episode") {
					const episodeProgram = program as Episode;

					let tmdbData;

					if (episodeTMDBCache.has(episodeProgram.episodeTMDB)) {
						return episodeTMDBCache.get(episodeProgram.episodeTMDB);
					} else {
						const response = await fetch(
							`/api/tmdb?episode=${episodeProgram.number}&id=${program.tmdb}&season=${episodeProgram.season}&type=tv`
						);

						if (!response.ok) {
							throw new Error(
								"Failed to fetch episode TMDB details"
							);
						}

						tmdbData = await response.json();

						episodeProgram.episodeTMDB = tmdbData.id;

						setEpisodeTMDBCache((prev) => {
							const tmdbCache = new Map(prev);

							tmdbCache.set(episodeProgram.episodeTMDB, tmdbData);

							return tmdbCache;
						});

						return tmdbData;
					}
				} else {
					if (
						program.episodeTMDB &&
						episodeTMDBCache.has(program.episodeTMDB)
					) {
						return episodeTMDBCache.get(program.episodeTMDB);
					}

					if (!program.episodeTMDB) {
						let tmdbData = showTMDBCache.get(program.tmdb);

						if (!tmdbData) {
							tmdbData = await fetchShowTMDB(program);
						}

						if (!tmdbData) {
							throw new Error("Could not fetch show data");
						}

						const seasons = tmdbData?.seasons.filter(
							(s: any) => s.season_number > 0
						);
						const season =
							seasons[Math.floor(Math.random() * seasons?.length)]
								?.season_number || 1;
						const seasonResponse = await fetch(
							`/api/tmdb?id=${program.tmdb}&season=${season}&type=tv`
						);

						if (!seasonResponse.ok) {
							throw new Error("Failed to fetch season details");
						}

						const seasonInfo = await seasonResponse.json();

						if (seasonInfo.episodes?.length > 0) {
							const releasedEpisodes = seasonInfo.episodes.filter(
								(e: any) => new Date(e.air_date) <= new Date()
							);

							const episode =
								releasedEpisodes[
									Math.floor(
										Math.random() * releasedEpisodes.length
									)
								] || seasonInfo.episodes[0];

							const episodeResponse = await fetch(
								`/api/tmdb?episode=${episode.episode_number}&id=${program.tmdb}&season=${season}&type=tv`
							);

							const episodeTMDB = await episodeResponse.json();

							setEpisodeTMDBCache((prev) => {
								const tmdbCache = new Map(prev);

								tmdbCache.set(episode.id, episodeTMDB);

								return tmdbCache;
							});

							program.episodeTMDB = episode.id;

							return episodeTMDB;
						}
					} else {
						console.warn(
							"Program has episodeTMDB but it's not in cache",
							program
						);

						return null;
					}
				}

				return null;
			} catch (error) {
				console.error("Error fetching episode:", error);
			}
		},
		[episodeTMDBCache, fetchShowTMDB, showTMDBCache]
	);

	const fetchEpisodeMeta = useCallback(
		async (program: Episode | Show) => {
			try {
				if (
					program.episodeTMDB &&
					episodeMetaCache.has(program.episodeTMDB)
				) {
					return episodeMetaCache.get(program.episodeTMDB);
				}

				let tmdbData;

				if (
					program.episodeTMDB &&
					episodeMetaCache.has(program.episodeTMDB)
				) {
					tmdbData = episodeTMDBCache.get(program.episodeTMDB!);
				} else {
					tmdbData = await fetchEpisodeTMDB(program);
				}

				if (!tmdbData) {
					console.error("Could not fetch TMDB data for episode", {
						title: program.title,
						kind: program.kind,
						tmdb: program.tmdb,
						episodeTMDB: program.episodeTMDB
					});
					return null;
				}

				const meta: EpisodeMeta = {
					episodeNumber: tmdbData.episode_number,
					episodeTitle: tmdbData.name,
					overview: tmdbData?.overview,
					releaseDate: tmdbData?.air_date,
					runtime: tmdbData?.runtime,
					season: tmdbData.season_number
				};

				if (program.episodeTMDB) {
					setEpisodeMetaCache((prev) => {
						const mc = new Map(prev);

						mc.set(program.episodeTMDB!, meta);

						return mc;
					});
				} else {
					console.error(
						"No episodeTMDB available after fetchEpisodeTMDB",
						program
					);
					return null;
				}

				return meta;
			} catch (error) {
				console.error("Error fetching episode TMDB details:", error);
			}
		},
		[episodeMetaCache, episodeTMDBCache, fetchEpisodeTMDB]
	);

	const fetchMovieTMDB = useCallback(
		async (program: Program) => {
			try {
				if (!program.tmdb) {
					return null;
				}

				let tmdbData;

				if (movieTMDBCache.has(program.tmdb)) {
					tmdbData = movieTMDBCache.get(program.tmdb);

					return null;
				} else {
					if (program.tmdb) {
						const response = await fetch(
							`/api/tmdb?id=${encodeURIComponent(
								program.tmdb
							)}&type=movie`
						);

						if (!response.ok) {
							setMovieTMDBCache((prev) => {
								const tmdbCache = new Map(prev);
								tmdbCache.set(program.tmdb, "FAILED");
								return tmdbCache;
							});

							throw new Error(
								"Failed to fetch movie TMDB details"
							);
						}

						tmdbData = await response.json();

						setMovieTMDBCache((prev) => {
							const tmdbCache = new Map(prev);

							tmdbCache.set(program.tmdb, tmdbData);

							return tmdbCache;
						});
					}
				}

				return tmdbData;
			} catch (error) {
				console.error("Error fetching movie TMDB details:", error);
			}
		},
		[movieTMDBCache]
	);

	const getProgramMeta = useCallback(
		(
			program: Episode | Program | Show
		): EpisodeMeta | ProgramMeta | null => {
			switch (program?.kind) {
				case "episode":
					return (
						episodeMetaCache?.get(
							(program as Episode).episodeTMDB!
						) || null
					);
				case "tv":
					return (
						episodeMetaCache?.get((program as Show).episodeTMDB!) ||
						null
					);
				case "movie":
					return movieMetaCache?.get(program.tmdb) || null;
			}
		},
		[episodeMetaCache, movieMetaCache]
	);

	const getRDTokens = useCallback(() => {
		if (typeof window === "undefined") {
			return null;
		}

		const auth = localStorage.getItem("rd_auth");

		return auth ? JSON.parse(auth) : null;
	}, []);

	const getUnrestrictedLink = useCallback(
		async (magnet: string) => {
			const auth = getRDTokens();

			if (!auth.tokens?.access_token) {
				return null;
			}

			try {
				const response = await fetch("/api/rd/unrestrict", {
					body: JSON.stringify({
						access_token: auth.tokens.access_token,
						link: magnet
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

				if (response.ok) {
					const data = await response.json();

					return data.download;
				}
			} catch (error) {
				console.error("Error getting unrestricted link:", error);
			}
		},
		[getRDTokens]
	);

	const fetchMovieMeta = useCallback(
		async (program: Program) => {
			let tmdbData;

			if (movieMetaCache.has(program.tmdb)) {
				tmdbData = movieMetaCache.get(program.tmdb);
			} else {
				tmdbData = await fetchMovieTMDB(program);
			}

			if (tmdbData) {
				const meta: ProgramMeta = {
					genres: tmdbData.genres.map((genre: Genre) => genre.name),
					overview: tmdbData.overview,
					releaseDate:
						tmdbData.release_date || tmdbData.first_air_date,
					runtime: tmdbData.runtime
				};

				setMovieMetaCache((prev) => {
					const mc = new Map(prev);

					mc.set(program.tmdb, meta);

					return mc;
				});

				return meta;
			}
		},
		[fetchMovieTMDB, movieMetaCache]
	);

	const ensureProgramMeta = useCallback(
		async (program: Episode | Program | Show) => {
			switch (program?.kind) {
				case "episode":
					const episode = program as Episode;

					if (!episodeMetaCache.has(episode.episodeTMDB!)) {
						await fetchEpisodeMeta(episode).catch(console.error);
					}

					break;
				case "tv":
					const show = program as Show;

					if (
						show.episodeTMDB &&
						episodeMetaCache.has(show.episodeTMDB)
					) {
						break;
					}

					await fetchEpisodeMeta(show).catch(console.error);

					break;
				case "movie":
					if (!movieMetaCache.has(program.tmdb)) {
						await fetchMovieMeta(program).catch(console.error);
					}

					break;
			}
		},
		[episodeMetaCache, fetchEpisodeMeta, fetchMovieMeta, movieMetaCache]
	);

	const fetchProgramLink = useCallback(
		async (program: Episode | Program | Show) => {
			await ensureProgramMeta(program);

			const meta = getProgramMeta(program);

			if (!meta || meta.link) {
				return meta?.link || null;
			}

			const query =
				program.kind === "movie"
					? `${program.title} ${meta.releaseDate.split("-")[0]}`
					: `${program.title} S${String(
							(meta as EpisodeMeta).season
					  ).padStart(2, "0")}E${String(
							(meta as EpisodeMeta).episodeNumber
					  ).padStart(2, "0")}`;

			if (!query) {
				return null;
			}

			const params = new URLSearchParams({ q: query });
			const response = await fetch(`/api/prowlarr?${params.toString()}`);

			if (!response.ok) {
				return null;
			}

			const results = await response.json();

			const hashes = Array.from(
				new Set(
					results
						.filter((result) => result.infoHash)
						.sort((a, b) => b.seeders - a.seeders)
						.map((result) => String(result.infoHash).trim())
				)
			);

			if (!hashes.length) {
				return null;
			}

			const stremthruResponse = await fetch("/api/stremthru", {
				body: JSON.stringify({ hashes }),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

			const cachedHashes = (
				await stremthruResponse.json()
			).data?.items.filter((item) => item.status === "cached");

			console.log(cachedHashes);

			return null;
		},
		[ensureProgramMeta, getProgramMeta]
	);

	const value: EPGContextType = {
		channels,
		currentChannelIndex,
		episodeMetaCache,
		episodeTMDBCache,
		ensureProgramMeta,
		fetchEpisodeTMDB,
		fetchEpisodeMeta,
		fetchProgramLink,
		fetchMovieMeta,
		fetchMovieTMDB,
		getProgramMeta,
		fetchShowTMDB,
		movieMetaCache,
		setCurrentChannelIndex,
		showTMDBCache
	};

	return <EPGContext.Provider value={value}>{children}</EPGContext.Provider>;
};

export const useEPG = () => {
	const context = useContext(EPGContext);

	if (context === undefined) {
		throw new Error("useEPG must be used within an EPGProvider");
	}

	return context;
};
