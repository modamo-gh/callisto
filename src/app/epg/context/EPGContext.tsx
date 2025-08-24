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

// Helper function
const pad2 = (num: number) => String(num).padStart(2, "0");

export const EPGProvider: React.FC<{
	children: ReactNode;
	channels: Channels;
}> = ({ channels, children }) => {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
	const [currentRDLink, setCurrentRDLink] = useState<string | null>(null);
	const [episodeTMDBCache, setEpisodeTMDBCache] = useState<
		Map<number, EpisodeMeta>
	>(new Map());
	const [episodeMetaCache, setEpisodeMetaCache] = useState<
		Map<number, EpisodeMeta>
	>(new Map());
	const [runtimeTracker, setRuntimeTracker] = useState<Map<string, number>>(
		new Map()
	);
	const [programMetaCache, setProgramMetaCache] = useState<
		Map<number, EpisodeMeta | ProgramMeta>
	>(new Map());
	const [movieMetaCache, setMovieMetaCache] = useState<
		Map<number, ProgramMeta>
	>(new Map());
	const [movieTMDBCache, setMovieTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [programTMDBCache, setProgramTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [showTMDBCache, setShowTMDBCache] = useState<Map<number, any>>(
		new Map()
	);
	const [showMetaCache, setShowMetaCache] = useState<
		Map<number, EpisodeMeta | ProgramMeta>
	>(new Map());

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

	// Store streaming links for each content
	const [streamingLinks, setStreamingLinks] = useState<Map<string, any>>(
		new Map()
	);

	// Rate limiting for Snowfl requests
	const requestQueue = useRef<Array<() => Promise<void>>>([]);
	const isProcessingQueue = useRef(false);
	const lastRequestTime = useRef(0);
	const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

	const processQueue = useCallback(async () => {
		if (isProcessingQueue.current || requestQueue.current.length === 0) {
			return;
		}

		isProcessingQueue.current = true;

		while (requestQueue.current.length > 0) {
			const now = Date.now();
			const timeSinceLastRequest = now - lastRequestTime.current;

			if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
				await new Promise((resolve) =>
					setTimeout(
						resolve,
						MIN_REQUEST_INTERVAL - timeSinceLastRequest
					)
				);
			}

			const request = requestQueue.current.shift();
			if (request) {
				lastRequestTime.current = Date.now();
				await request();
			}
		}

		isProcessingQueue.current = false;
	}, []);

	// Function to search for content using Snowfl with rate limiting and retry logic
	const searchContent = useCallback(
		async (content: EnrichedContent) => {
			return new Promise<any>((resolve) => {
				// Define searchQuery outside so it's accessible in catch block
				let searchQuery = "";

				if (content.type === "movie") {
					searchQuery = content.title;
				} else {
					// For TV shows, include season and episode info
					searchQuery = `${content.title} S${pad2(
						content.seasonNumber || 1
					)}E${pad2(content.episodeNumber || 1)}`;
				}

				const makeRequest = async () => {
					// Check if we already have cached results
					if (streamingLinks.has(content.id)) {
						resolve(streamingLinks.get(content.id));
						return;
					}

					try {
						const params = new URLSearchParams({
							prefix: process.env.NEXT_PUBLIC_SNOWFL_PREFIX || "",
							q: searchQuery,
							session: sessionRef.current,
							page: "0",
							sort: "NONE",
							top: "NONE",
							nsfw: "1"
						});

						console.log(`Searching Snowfl for: "${searchQuery}"`);

						const response = await fetch(
							`/api/snowfl?${params.toString()}`,
							{
								signal: AbortSignal.timeout(10000) // 10 second timeout
							}
						);

						if (response.ok) {
							const data = await response.json();
							console.log(
								`✅ Snowfl found ${
									data?.length || 0
								} results for "${searchQuery}"`
							);

							// Store the streaming links for this content
							if (data && data.length > 0) {
								setStreamingLinks((prev) => {
									const newLinks = new Map(prev);
									newLinks.set(content.id, data);
									return newLinks;
								});
								resolve(data);
							} else {
								resolve(null);
							}
						} else if (response.status === 503) {
							console.warn(
								`⚠️ Snowfl 503 (Service Unavailable) for "${searchQuery}" - will retry later`
							);
							resolve(null);
						} else {
							const errorText = await response
								.text()
								.catch(() => "Unknown error");
							console.error(
								`❌ Snowfl search failed (${response.status}):`,
								errorText
							);
							resolve(null);
						}
					} catch (error: any) {
						if (error.name === "TimeoutError") {
							console.warn(
								`⏰ Snowfl search timeout for "${searchQuery}"`
							);
						} else {
							console.error(
								`❌ Error searching content for "${searchQuery}":`,
								error
							);
						}
						resolve(null);
					}
				};

				requestQueue.current.push(makeRequest);
				processQueue();
			});
		},
		[processQueue]
	);

	// Effect to update current content and RD link when channel changes
	useEffect(() => {
		const getCurrentContent = () => {
			const currentChannel = channels[currentChannelIndex];
			if (
				!currentChannel ||
				!currentChannel.data ||
				currentChannel.data.length === 0
			) {
				return null;
			}

			const content = currentChannel.data[0];
			const tmdbKey =
				content.episode?.ids.tmdb ||
				content.ids?.tmdb ||
				content.movie?.ids.tmdb ||
				content.show?.ids.tmdb;

			return enrichedCache[tmdbKey];
		};

		const currentEnrichedContent = getCurrentContent();

		if (currentEnrichedContent) {
			setCurrentContent(currentEnrichedContent);

			// Get preloaded streaming links
			const links = streamingLinks.get(currentEnrichedContent.id);
			if (links && links.length > 0) {
				setCurrentRDLink(links[0]?.link || null);
			} else {
				setCurrentRDLink(null);
			}
		}
	}, [currentChannelIndex, channels, streamingLinks]);

	const getEpisode = useCallback(
		async (program: Episode | Program, showData: any) => {
			try {
				let season = (program as Episode).seasonNumber || null;

				if (!season) {
					const seasons = showData.seasons.filter(
						(s: any) => s.season_number > 0
					);
					season =
						seasons[Math.floor(Math.random() * seasons.length)]
							?.season_number || 1;
				}

				const seasonResponse = await fetch(
					`https://api.themoviedb.org/3/tv/${program.tmdb}/season/${season}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
				);

				if (!seasonResponse.ok) {
					throw new Error("Failed to fetch season details");
				}

				const seasonInfo = await seasonResponse.json();

				let episode =
					seasonInfo[(program as Episode).episodeNumber] || null;

				if (!episode && seasonInfo.episodes?.length > 0) {
					const releasedEpisodes = seasonInfo.episodes.filter(
						(e: any) => new Date(e.air_date) <= new Date()
					);

					episode =
						releasedEpisodes[
							Math.floor(Math.random() * releasedEpisodes.length)
						] || seasonInfo.episodes[0];
				}

				return episode;
			} catch (error) {
				console.error("Error fetching episode:", error);
				return null;
			}
		},
		[]
	);

	const getEpisodeMeta = useCallback(
		async (index: number, episode: Episode) => {
			try {
				let tmdbData;

				if (episodeTMDBCache.has(episode.episodeTMDB)) {
					tmdbData = episodeTMDBCache.get(episode.episodeTMDB);
				} else {
					const response = await fetch(
						`https://api.themoviedb.org/3/tv/${episode.tmdb}/season/${episode.season}/episode/${episode.number}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
					);

					if (!response.ok) {
						throw new Error("Failed to fetch episode TMDB details");
					}

					tmdbData = await response.json();

					setEpisodeTMDBCache((prev) => {
						const tmdbCache = new Map(prev);

						tmdbCache.set(episode.tmdb, tmdbData);

						return tmdbCache;
					});
				}

				if (episodeMetaCache.has(episode.tmdb)) {
					return;
				}

				const meta: EpisodeMeta = {
					overview: tmdbData.overview,
					releaseDate: tmdbData.air_date,
					runtime: tmdbData.runtime
				};

				setEpisodeMetaCache((prev) => {
					const mc = new Map(prev);

					mc.set(episode.tmdb, meta);

					return mc;
				});
			} catch (error) {
				console.error("Error fetching episode TMDB details:", error);
			}
		},
		[episodeMetaCache, episodeTMDBCache]
	);

	const getMovieMeta = useCallback(
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

				if (movieMetaCache.has(program.tmdb)) {
					return;
				}

				const meta: ProgramMeta = {
					genres: tmdbData.genres.map((genre: any) => genre.name),
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
			} catch (error) {
				console.error("Error fetching movie TMDB details:", error);
			}
		},
		[movieMetaCache, movieTMDBCache]
	);

	const getProgramMeta = useCallback(
		async (index: number, program: Program) => {
			try {
				let tmdbData;

				if (programTMDBCache.has(program.tmdb)) {
					tmdbData = programTMDBCache.get(program.tmdb);
				} else {
					const response = await fetch(
						`https://api.themoviedb.org/3/${program.kind}/${program.tmdb}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
					);

					if (!response.ok) {
						throw new Error("Failed to fetch TMDB details");
					}

					tmdbData = await response.json();

					setProgramTMDBCache((prev) => {
						const tmdbCache = new Map(prev);

						tmdbCache.set(program.tmdb, tmdbData);

						return tmdbCache;
					});
				}

				if (
					programMetaCache.has(program.tmdb) &&
					program.kind === "movie"
				) {
					return;
				}

				if (program.kind === "tv") {
					const episode = await getEpisode(program, tmdbData);

					if (episodeMetaCache.has(episode.tmdb)) {
						return;
					}

					const meta: EpisodeMeta = {
						episodeNumber: episode?.episode_number,
						genres: tmdbData.genres.map((genre: any) => genre.name),
						name: episode?.name,
						overview: episode?.overview || tmdbData.overview,
						releaseDate: episode?.air_date || tmdbData.release_date,
						runtime:
							episode?.runtime ||
							tmdbData.episode_run_time?.[0] ||
							30,
						seasonNumber: episode?.season_number
					};

					setEpisodeMetaCache((prev) => {
						const mc = new Map(prev);

						mc.set(episode.tmdb, meta);

						return mc;
					});
				} else {
					const meta: ProgramMeta = {
						genres: tmdbData.genres.map((genre: any) => genre.name),
						overview: tmdbData.overview,
						releaseDate:
							tmdbData.release_date || tmdbData.first_air_date,
						runtime: tmdbData.runtime
					};

					setProgramMetaCache((prev) => {
						const mc = new Map(prev);

						mc.set(program.tmdb, meta);

						return mc;
					});
				}

				// if (isFirstInChannel) {
				// 	setRuntimeTracker((prev) => {
				// 		const rT = new Map(prev);

				// 		rT.set(basicContent.id, enrichedContent.runtime || 30);

				// 		return rT;
				// 	});
				// }

				// Store enriched content first
				// setEnrichedCache((prev) => ({
				// 	...prev,
				// 	[basicContent.type === "movie" ||
				// 	!basicContent.episodeTMDBID
				// 		? basicContent.tmdbID
				// 		: basicContent.episodeTMDBID]: enrichedContent
				// }));

				// // Then search for streaming links (preload strategy) - non-blocking
				// searchContent(enrichedContent)
				// 	.then((results) => {
				// 		if (results) {
				// 			console.log(
				// 				`🎬 Preloaded streaming links for: ${enrichedContent.title}`
				// 			);
				// 		}
				// 	})
				// 	.catch((error) =>
				// 		console.error(
				// 			"Error preloading streaming links:",
				// 			error
				// 		)
				// 	);
			} catch (error) {
				console.error("Error fetching TMDB details:", error);
			}
		},
		[getEpisode, programMetaCache, programTMDBCache]
	);

	const getShowMeta = useCallback(
		async (index: number, show: Show) => {
			try {
				let tmdbData;

				if (showTMDBCache.has(show.tmdb)) {
					tmdbData = showTMDBCache.get(show.tmdb);
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
				}
			} catch (error) {
				console.error("Error fetching episode TMDB details:", error);
			}
		},
		[showTMDBCache]
	);

	const fetchEpisodeTMDB = useCallback(async (show: Show) => {
		try {
			const tmdbData = showTMDBCache.get(show.tmdb);

			console.log("TMDB", tmdbData)

			const seasons = tmdbData?.seasons.filter(
				(s: any) => s.season_number > 0
			);
			const season =
				seasons[Math.floor(Math.random() * seasons?.length)]
					?.season_number || 1;

			const seasonResponse = await fetch(
				`https://api.themoviedb.org/3/tv/${show.tmdb}/season/${season}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
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
						Math.floor(Math.random() * releasedEpisodes.length)
					] || seasonInfo.episodes[0];

				const meta: EpisodeMeta = {
					episodeNumber: episode.episode_number,
					episodeTitle: episode.name,
					overview: episode.overview,
					releaseDate: episode.air_date,
					runtime: episode.runtime,
					season: episode.season_number
				};

				setEpisodeMetaCache((prev) => {
					const mc = new Map(prev);

					mc.set(episode.id, meta);

					return mc;
				});

				return episode.id;
			}
		} catch (error) {
			console.error("Error fetching episode:", error);
			return null;
		}
	}, [showTMDBCache]);

	const value: EPGContextType = {
		channels,
		currentChannelIndex,
		currentRDLink,
		episodeMetaCache,
		episodeTMDBCache,
		fetchEpisodeTMDB,
		getEpisodeMeta,
		getMovieMeta,
		getProgramMeta,
		getShowMeta,
		movieMetaCache,
		programMetaCache,
		programTMDBCache,
		runtimeTracker,
		streamingLinks,
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
