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
	enrichContent: (
		basicContent: BasicContent,
		isFirstInChannel: boolean
	) => Promise<void>;
	enrichedCache: {
		[tmdbID: number]: EnrichedContent;
	};
	hasBeenEnriched: Set<string>;
	runtimeTracker: Map<string, number>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	setCurrentContent: Dispatch<SetStateAction<EnrichedContent | undefined>>;
	setEnrichedCache: Dispatch<
		SetStateAction<{
			[tmdbID: number]: EnrichedContent;
		}>
	>;
	setHasBeenEnriched: Dispatch<SetStateAction<Set<string>>>;
	setRuntimeTracker: Dispatch<SetStateAction<Map<string, number>>>;
}

const EPGContext = createContext<EPGContextType | undefined>(undefined);

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

	useEffect(() => {
		const params = new URLSearchParams({
			prefix: process.env.SNOWFL_PREFIX,
			q: `${channels[currentChannelIndex].title} S${pad2(channels[currentChannelIndex].seasonNumber)}E${pad2(channels[currentChannelIndex].episodeNumber)}`,
			session: sessionRef.current,
			page: "0",
			sort: "NONE",
			top: "NONE",
			nsfw: "1"
		});

		const r = await fetch(`/api/snowfl?${params.toString()}`);

		console.log(r);
	}, [currentChannelIndex]);

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
					genres: tmdbData.genres.map((genre) => genre.name),
					overview: tmdbData.overview,
					releaseDate: tmdbData.release_date,
					runtime: tmdbData.runtime
				};

				if (basicContent.type === "tv") {
					const episode = await getEpisode(enrichedContent, tmdbData);

					enrichedContent = {
						...enrichedContent,
						episodeName: episode?.name,
						episodeNumber: episode?.episode_number,
						overview: episode?.overview,
						releaseDate: episode?.air_date,
						runtime: episode?.runtime,
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

				setEnrichedCache((prev) => ({
					...prev,
					[basicContent.type === "movie" ||
					!basicContent.episodeTMDBID
						? basicContent.tmdbID
						: basicContent.episodeTMDBID]: enrichedContent
				}));
			} catch (error) {
				console.error("Error fetching TMDB details:", error);
			}
		},
		[]
	);

	const getEpisode = useCallback(
		async (content: EnrichedContent, showData: any) => {
			try {
				let season = content.seasonNumber || null;

				if (!season) {
					const seasons = showData.seasons.filter(
						(s) => s.season_number
					);
					season =
						seasons[Math.floor(Math.random() * seasons.length)]
							.season_number;
				}

				const seasonResponse = await fetch(
					`https://api.themoviedb.org/3/tv/${content.tmdbID}/season/${season}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
				);
				const seasonInfo = await seasonResponse.json();

				let episode =
					seasonInfo.episodes.find(
						(e) => e.episode_number === content.episodeNumber
					) || null;

				if (!episode) {
					const releasedEpisodes = seasonInfo.episodes.filter(
						(e) => Date.now() >= new Date(e.air_date).getTime()
					);

					episode =
						releasedEpisodes[
							Math.floor(Math.random() * releasedEpisodes.length)
						];
				}

				return episode;
			} catch (error) {
				console.error("Error fetching random episode:", error);
			}
		},
		[]
	);

	const value: EPGContextType = {
		channels,
		currentChannelIndex,
		currentContent,
		enrichContent,
		enrichedCache,
		hasBeenEnriched,
		runtimeTracker,
		setCurrentChannelIndex,
		setCurrentContent,
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
