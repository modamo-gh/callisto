import {
	createContext,
	Dispatch,
	ReactNode,
	SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from "react";

export interface BasicContent {
	id: string;
	title: string;
	tmdbID: number;
	type: "movie" | "tv";
}

export interface EnrichedContent extends BasicContent {
	episodeName?: string;
	episodeNumber?: number;
	episodeTMDBID?: number;
	genres?: string[];
	overview?: string;
	releaseDate?: string;
	runtime?: number;
	seasonNumber?: number;
}

interface EPGContextType {
	channels: any[];
	currentChannelIndex: number;
	currentContent: any;
	currentRDLink: string | null;
	enrichContent: (
		basicContent: BasicContent,
		isFirstInChannel: boolean
	) => Promise<void>;
	enrichedCache: {
		[tmdbID: number]: EnrichedContent;
	};
	hasBeenEnriched: Set<string>;
	runtimeTracker: Map<string, number>;
	streamingLinks: Map<string, any>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	setCurrentContent: Dispatch<SetStateAction<EnrichedContent | undefined>>;
	setCurrentRDLink: Dispatch<SetStateAction<string | null>>;
	setEnrichedCache: Dispatch<
		SetStateAction<{
			[tmdbID: number]: EnrichedContent;
		}>
	>;
	setHasBeenEnriched: Dispatch<SetStateAction<Set<string>>>;
	setRuntimeTracker: Dispatch<SetStateAction<Map<string, number>>>;
}

const EPGContext = createContext<EPGContextType | undefined>(undefined);

// Helper function
const pad2 = (num: number) => String(num).padStart(2, "0");

export const EPGProvider: React.FC<{
	children: ReactNode;
	initialChannels: any[];
}> = ({ children, initialChannels }) => {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [channels] = useState(initialChannels);
	const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
	const [currentContent, setCurrentContent] = useState<
		EnrichedContent | undefined
	>();
	const [enrichedCache, setEnrichedCache] = useState<{
		[tmdbID: number]: EnrichedContent;
	}>({});
	const [hasBeenEnriched, setHasBeenEnriched] = useState<Set<string>>(
		new Set<string>()
	);
	const [currentRDLink, setCurrentRDLink] = useState<string | null>(null);
	const [runtimeTracker, setRuntimeTracker] = useState<Map<string, number>>(
		new Map()
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

	// Store streaming links for each content
	const [streamingLinks, setStreamingLinks] = useState<Map<string, any>>(new Map());

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
				await new Promise(resolve => 
					setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
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
	const searchContent = useCallback(async (content: EnrichedContent) => {
		return new Promise<any>((resolve) => {
			// Define searchQuery outside so it's accessible in catch block
			let searchQuery = "";
			
			if (content.type === "movie") {
				searchQuery = content.title;
			} else {
				// For TV shows, include season and episode info
				searchQuery = `${content.title} S${pad2(content.seasonNumber || 1)}E${pad2(content.episodeNumber || 1)}`;
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
					
					const response = await fetch(`/api/snowfl?${params.toString()}`, {
						signal: AbortSignal.timeout(10000) // 10 second timeout
					});
					
					if (response.ok) {
						const data = await response.json();
						console.log(`✅ Snowfl found ${data?.length || 0} results for "${searchQuery}"`);
						
						// Store the streaming links for this content
						if (data && data.length > 0) {
							setStreamingLinks(prev => {
								const newLinks = new Map(prev);
								newLinks.set(content.id, data);
								return newLinks;
							});
							resolve(data);
						} else {
							resolve(null);
						}
					} else if (response.status === 503) {
						console.warn(`⚠️ Snowfl 503 (Service Unavailable) for "${searchQuery}" - will retry later`);
						resolve(null);
					} else {
						const errorText = await response.text().catch(() => 'Unknown error');
						console.error(`❌ Snowfl search failed (${response.status}):`, errorText);
						resolve(null);
					}
				} catch (error: any) {
					if (error.name === 'TimeoutError') {
						console.warn(`⏰ Snowfl search timeout for "${searchQuery}"`);
					} else {
						console.error(`❌ Error searching content for "${searchQuery}":`, error);
					}
					resolve(null);
				}
			};

			requestQueue.current.push(makeRequest);
			processQueue();
		});
	}, [processQueue]);

	// Effect to update current content and RD link when channel changes
	useEffect(() => {
		const getCurrentContent = () => {
			const currentChannel = channels[currentChannelIndex];
			if (!currentChannel || !currentChannel.data || currentChannel.data.length === 0) {
				return null;
			}

			const content = currentChannel.data[0];
			const tmdbKey = content.episode?.ids.tmdb ||
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
	}, [currentChannelIndex, enrichedCache, channels, streamingLinks]);

	const enrichContent = useCallback(
		async (
			basicContent: EnrichedContent,
			isFirstInChannel: boolean = false
		) => {
			if (
				enrichedCache[
					basicContent.type === "movie" || !basicContent.episodeTMDBID
						? basicContent.tmdbID
						: basicContent.episodeTMDBID
				]
			) {
				return;
			}

			try {
				const response = await fetch(
					`https://api.themoviedb.org/3/${basicContent.type}/${basicContent.tmdbID}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
				);

				if (!response.ok) {
					throw new Error("Failed to fetch TMDB details");
				}

				const tmdbData = await response.json();

				let enrichedContent: EnrichedContent = {
					...basicContent,
					genres: tmdbData.genres.map((genre: any) => genre.name),
					overview: tmdbData.overview,
					releaseDate: tmdbData.release_date || tmdbData.first_air_date,
					runtime: tmdbData.runtime
				};

				if (basicContent.type === "tv") {
					const episode = await getEpisode(enrichedContent, tmdbData);

					enrichedContent = {
						...enrichedContent,
						episodeName: episode?.name,
						episodeNumber: episode?.episode_number,
						overview: episode?.overview || enrichedContent.overview,
						releaseDate: episode?.air_date || enrichedContent.releaseDate,
						runtime: episode?.runtime || tmdbData.episode_run_time?.[0] || 30,
						seasonNumber: episode?.season_number
					};
				}

				if (isFirstInChannel) {
					setRuntimeTracker((prev) => {
						const rT = new Map(prev);

						rT.set(basicContent.id, enrichedContent.runtime || 30);

						return rT;
					});
				}

				// Store enriched content first
				setEnrichedCache((prev) => ({
					...prev,
					[basicContent.type === "movie" ||
					!basicContent.episodeTMDBID
						? basicContent.tmdbID
						: basicContent.episodeTMDBID]: enrichedContent
				}));

				// Then search for streaming links (preload strategy) - non-blocking
				searchContent(enrichedContent).then((results) => {
					if (results) {
						console.log(`🎬 Preloaded streaming links for: ${enrichedContent.title}`);
					}
				}).catch(error => 
					console.error("Error preloading streaming links:", error)
				);

			} catch (error) {
				console.error("Error fetching TMDB details:", error);
			}
		},
		[enrichedCache, searchContent] // Added searchContent dependency
	);

	const getEpisode = useCallback(
		async (content: EnrichedContent, showData: any) => {
			try {
				let season = content.seasonNumber || null;

				if (!season) {
					const seasons = showData.seasons.filter(
						(s: any) => s.season_number > 0
					);
					season =
						seasons[Math.floor(Math.random() * seasons.length)]
							?.season_number || 1;
				}

				const seasonResponse = await fetch(
					`https://api.themoviedb.org/3/tv/${content.tmdbID}/season/${season}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
				);
				
				if (!seasonResponse.ok) {
					throw new Error("Failed to fetch season details");
				}
				
				const seasonInfo = await seasonResponse.json();

				let episode =
					seasonInfo.episodes?.find(
						(e: any) => e.episode_number === content.episodeNumber
					) || null;

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

	const value: EPGContextType = {
		channels,
		currentChannelIndex,
		currentContent,
		currentRDLink,
		enrichContent,
		enrichedCache,
		hasBeenEnriched,
		runtimeTracker,
		streamingLinks,
		setCurrentChannelIndex,
		setCurrentContent,
		setCurrentRDLink,
		setEnrichedCache,
		setHasBeenEnriched,
		setRuntimeTracker
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