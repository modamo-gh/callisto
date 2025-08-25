import {
	Channels,
	EPGContextType,
	Episode,
	EpisodeMeta,
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
	useRef,
	useState
} from "react";

const EPGContext = createContext<EPGContextType | undefined>(undefined);

export const EPGProvider: React.FC<{
	children: ReactNode;
	channels: Channels;
}> = ({ channels, children }) => {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
	const [currentRDLink, setCurrentRDLink] = useState<string | null>(null);
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
	const [runtimeTracker, setRuntimeTracker] = useState<Map<string, number>>(
		new Map()
	);
	const [showTMDBCache, setShowTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [showMetaCache, setShowMetaCache] = useState<
		Map<number, EpisodeMeta | ProgramMeta>
	>(new Map());

	const getRDTokens = useCallback(() => {
		if (typeof window === "undefined") {
			return null;
		}

		const auth = localStorage.getItem("rd_auth");

		return auth ? JSON.parse(auth).tokens : null;
	}, []);

	const extractHashFromMagnet = useCallback(
		(magnet: string): string | null => {
			const match = magnet.match(/btih:([a-f0-9]{40})/i);

			return match ? match[1].toLowerCase() : null;
		},
		[]
	);

	const checkRDAvailability = useCallback(
		async (magnets: string[]) => {
			const {tokens} = getRDTokens();

			if (!tokens?.access_token) {
				return {};
			}

			const hashes = magnets
				.map(extractHashFromMagnet)
				.filter(Boolean) as string[];

			if (!hashes.length) {
				return {};
			}

			try {
				const response = await fetch("/api/rd/instant-availability", {
					body: JSON.stringify({
						access_token: tokens.access_token,
						hashes
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

				if (response.ok) {
					return await response.json();
				}
			} catch (error) {
				console.error("Error checking RD availability:", error);
			}

			return {};
		},
		[extractHashFromMagnet, getRDTokens]
	);

	const getUnrestrictedLink = useCallback(
		async (magnet: string) => {
			const {tokens} = getRDTokens();

			if (!tokens?.access_token) {
				return null;
			}

			try {
				const response = await fetch("/api/rd/unrestrict", {
					body: JSON.stringify({
						access_token: tokens.access_token,
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

	useEffect(() => {
		const updateRuntimes = () => {
			setRuntimeTracker((prev) => {
				const rT = new Map(prev);

				for (const [id, runtime] of rT) {
					rT.set(id, Math.max(0, runtime - 1));
				}

				return rT;
			});
		};

		const MIN = 60000;
		const msUntilNextMinute = MIN - (Date.now() % MIN);

		timeoutRef.current = setTimeout(() => {
			updateRuntimes();

			intervalRef.current = setInterval(updateRuntimes, MIN);
		}, msUntilNextMinute);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}

			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	const sessionRef = useRef(
		Array.from(crypto.getRandomValues(new Uint8Array(6)))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.slice(0, 8)
			.toUpperCase()
	);

	const fetchShowTMDB = useCallback(
		async (index: number, show: Show) => {
			try {
				let tmdbData;

				if (showTMDBCache.has(show.tmdb)) {
					return showTMDBCache.get(show.tmdb);
				} else {
					const response = await fetch(
						`https://api.themoviedb.org/3/tv/${show.tmdb}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
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
							`https://api.themoviedb.org/3/tv/${program.tmdb}/season/${episodeProgram.season}/episode/${episodeProgram.number}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
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
							tmdbData = await fetchShowTMDB(0, program);
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
							`https://api.themoviedb.org/3/tv/${program.tmdb}/season/${season}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
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
								`https://api.themoviedb.org/3/tv/${program.tmdb}/season/${season}/episode/${episode.episode_number}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
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

	const fetchProgramLink = useCallback(
		async (program: Episode | Program | Show) => {
			await ensureProgramMeta(program);

			const meta = getProgramMeta(program);

			if (meta?.link) {
				return meta?.link;
			}

			let searchQuery = "";

			switch (program.kind) {
				case "episode":
					const episode = program as Episode;

					searchQuery = `${program.title} S${String(
						episode.season
					).padStart(2, "0")}E${String(episode.number).padStart(
						2,
						"0"
					)}`;

					break;
				case "movie":
					searchQuery = `${program.title} ${
						meta?.releaseDate?.split("-")[0]
					}`;

					break;
				case "tv":
					const episodeMeta = meta as EpisodeMeta;

					searchQuery = `${program.title} S${String(
						episodeMeta?.season || 1
					).padStart(2, "0")}E${String(
						episodeMeta?.episodeNumber || 1
					).padStart(2, "0")}`;

					break;
			}

			console.log(`🔍 Searching Snowfl for: "${searchQuery}"`);

			try {
				const params = new URLSearchParams({ q: searchQuery });
				const response = await fetch(`/api/snowfl?${params}`);

				if (response.ok) {
					const results = await response.json();

					console.log(`📊 Snowfl results:`, results);

					if (results.data && results.data.length) {
						const magnets = results.data
							.map((result) => result.magnet)
							.filter(Boolean);

						if (magnets.length) {
							console.log(
								"🔍 Checking RD availability for magnets..."
							);

							const availability = await checkRDAvailability(
								magnets
							);

							let cachedMagnet = null;
							let unrestrictedLink = null;

							for (const magnet of magnets) {
								const hash = extractHashFromMagnet(magnet);

								if (hash && availability[hash]) {
									console.log(
										`✅ Found cached torrent: ${hash}`
									);

									cachedMagnet = magnet;

									unrestrictedLink =
										await getUnrestrictedLink(magnet);

									if (unrestrictedLink) {
										console.log(
											`🎬 Got unrestricted link!`
										);

										break;
									}
								}
							}

							switch (program.kind) {
								case "movie":
									setMovieMetaCache((prev) => {
										const mc = new Map(prev);
										const meta = mc.get(program.tmdb);

										if (meta) {
											mc.set(program.tmdb, {
												...meta,
												link: unrestrictedLink
											});
										}

										return mc;
									});

									break;
								case "episode":
								case "tv":
									const episode = program as Episode | Show;

									if (episode.episodeTMDB) {
										setEpisodeMetaCache((prev) => {
											const mc = new Map(prev);
											const meta = mc.get(
												episode.episodeTMDB!
											);

											if (meta) {
												mc.set(episode.episodeTMDB!, {
													...meta,
													link: unrestrictedLink
												});
											}

											return mc;
										});
									}

									break;
							}

							return unrestrictedLink;
						} else {
							console.log(
								`❌ No results found for "${searchQuery}"`
							);
						}
					} else {
						const errorData = await response
							.json()
							.catch(() => ({}));

						console.error(
							`❌ Snowfl API error: ${response.status}`,
							errorData
						);

						if (response.status === 503) {
							console.log(
								`⚠️ Snowfl service unavailable, skipping "${searchQuery}"`
							);
						}
					}
				}

				return null;
			} catch (error) {
				console.error("Error fetching program link:", error);

				return null;
			}
		},
		[
			checkRDAvailability, extractHashFromMagnet, getUnrestrictedLink
		]
	);

	const fetchEpisodeMeta = useCallback(
		async (index: number, program: Episode | Show) => {
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

				fetchProgramLink(program).catch(console.error);

				return meta;
			} catch (error) {
				console.error("Error fetching episode TMDB details:", error);
			}
		},
		[episodeMetaCache, episodeTMDBCache, fetchEpisodeTMDB]
	);

	const fetchMovieTMDB = useCallback(
		async (index: number, program: Program) => {
			try {
				let tmdbData;

				if (movieTMDBCache.has(program.tmdb)) {
					tmdbData = movieTMDBCache.get(program.tmdb);
				} else {
					const response = await fetch(
						`https://api.themoviedb.org/3/movie/${program.tmdb}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
					);

					if (!response.ok) {
						throw new Error("Failed to fetch movie TMDB details");
					}

					tmdbData = await response.json();

					setMovieTMDBCache((prev) => {
						const tmdbCache = new Map(prev);

						tmdbCache.set(program.tmdb, tmdbData);

						return tmdbCache;
					});
				}

				return tmdbData;
			} catch (error) {
				console.error("Error fetching movie TMDB details:", error);
			}
		},
		[movieTMDBCache]
	);

	const fetchMovieMeta = useCallback(
		async (index: number, program: Program) => {
			let tmdbData;

			if (movieMetaCache.has(program.tmdb)) {
				tmdbData = movieMetaCache.get(program.tmdb);
			} else {
				tmdbData = await fetchMovieTMDB(0, program);
			}

			const meta: ProgramMeta = {
				genres: tmdbData.genres.map((genre: any) => genre.name),
				overview: tmdbData.overview,
				releaseDate: tmdbData.release_date || tmdbData.first_air_date,
				runtime: tmdbData.runtime
			};

			setMovieMetaCache((prev) => {
				const mc = new Map(prev);

				mc.set(program.tmdb, meta);

				return mc;
			});

			fetchProgramLink(program).catch(console.error);

			return meta;
		},
		[fetchMovieTMDB, fetchProgramLink, movieMetaCache]
	);

	const ensureProgramMeta = useCallback(
		async (program: Episode | Program | Show) => {
			switch (program.kind) {
				case "episode":
					const episode = program as Episode;

					if (!episodeMetaCache.has(episode.episodeTMDB!)) {
						await fetchEpisodeMeta(0, episode).catch(console.error);
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

					await fetchEpisodeMeta(0, show).catch(console.error);

					break;
				case "movie":
					if (!movieMetaCache.has(program.tmdb)) {
						await fetchMovieMeta(0, program).catch(console.error);
					}

					break;
			}
		},
		[episodeMetaCache, fetchEpisodeMeta, fetchMovieMeta, movieMetaCache]
	);

	const getProgramMeta = useCallback(
		(
			program: Episode | Program | Show
		): EpisodeMeta | ProgramMeta | null => {
			switch (program.kind) {
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

	const value: EPGContextType = {
		channels,
		currentChannelIndex,
		currentRDLink,
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
		runtimeTracker,
		setCurrentChannelIndex,
		setCurrentRDLink,
		setRuntimeTracker,
		showMetaCache
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
