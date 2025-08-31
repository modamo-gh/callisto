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

				console.log(meta);

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

			if (!meta) {
				return null;
			}

			if (meta?.link) {
				return meta.link;
			}

			const query =
				program.kind === "movie"
					? `${program.title} ${
							meta?.releaseDate?.split("-")[0] ?? ""
					  }`.trim()
					: `${program.title} S${String(
							(meta as EpisodeMeta).season
					  ).padStart(2, "0")}E${String(
							(meta as EpisodeMeta).episodeNumber
					  ).padStart(2, "0")}`;

			if (!query) return null;

			// 1) Search Prowlarr
			const params = new URLSearchParams({ q: query });
			const r = await fetch(`/api/prowlarr?${params.toString()}`);
			if (!r.ok) return null;

			const results = await r.json();
			const hashes: string[] = Array.from(
				new Set(
					results
						.filter((x: any) => x.infoHash)
						.sort((a: any, b: any) => b.seeders - a.seeders)
						.map((x: any) => String(x.infoHash).trim())
				)
			);
			if (!hashes.length) return null;

			// 2) Check StremThru cache
			const st = await fetch("/api/stremthru", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ hashes })
			});
			if (!st.ok) return null;

			const stData = await st.json();
			const items = (stData?.data?.items ?? []).filter(
				(i: any) => i.status === "cached"
			);

			if (!items.length) return null;

			// Choose the best cached item (largest video file)
			const videoRe = /\.(mkv|mp4|m4v|mov|avi)$/i;
			const pick = items
				.map((item: any) => {
					const best = (item.files ?? [])
						.filter(
							(f: any) =>
								videoRe.test(f.name) &&
								f.size > 100 * 1024 * 1024
						)
						.sort((a: any, b: any) => b.size - a.size)[0];
					return { item, size: best?.size ?? 0 };
				})
				.sort((a: any, b: any) => b.size - a.size)[0]?.item;

			if (!pick?.magnet) return null;

			// 3) Convert magnet -> RD direct link
			const auth = getRDTokens();
			const access_token = auth?.tokens?.access_token;
			if (!access_token) return null;

			const rdRes = await fetch("/api/rd/magnetToLink", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					access_token,
					magnet: pick.magnet,
					select: "largest" // server route chooses largest video
				})
			});

			if (!rdRes.ok) {
				console.warn("magnetToLink failed:", await rdRes.text());
				return null;
			}

			const rd = await rdRes.json(); // expect { download, filename, ... }
			const link: string | null = rd?.download ?? null;
			if (!link) return null;

			// 4) Persist link into the appropriate cache and return it
			if (program.kind === "movie") {
				setMovieMetaCache((prev) => {
					const mc = new Map(prev);
					const old = mc.get(program.tmdb) as ProgramMeta | undefined;
					mc.set(program.tmdb, {
						...(old ?? ({} as ProgramMeta)),
						link
					});
					return mc;
				});
			} else {
				const key =
					program.kind === "episode"
						? (program as Episode).episodeTMDB
						: (program as Show).episodeTMDB;
				if (key) {
					setEpisodeMetaCache((prev) => {
						const mc = new Map(prev);
						const old = mc.get(key) as EpisodeMeta | undefined;
						mc.set(key, { ...(old ?? ({} as EpisodeMeta)), link });
						return mc;
					});
				}
			}

			return link;
		},
		[
			ensureProgramMeta,
			getProgramMeta,
			getRDTokens,
			setEpisodeMetaCache,
			setMovieMetaCache
		]
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
				for (let i = 0; i < Math.min(channel.programs.length, 4); i++) {
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
