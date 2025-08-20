import {
	createContext,
	Dispatch,
	ReactNode,
	SetStateAction,
	useCallback,
	useContext,
	useState
} from "react";

export interface BasicContent {
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
	remainingRuntime?: number;
	runtime?: number;
	seasonNumber?: number;
}

interface EPGContextType {
	channels: any[];
	currentChannelIndex: number;
	currentContent: any;
	enrichContent: (basicContent: BasicContent) => Promise<void>;
	enrichedCache: {
		[tmdbID: number]: EnrichedContent;
	};
	hasBeenEnriched: Set<string>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	setCurrentContent: Dispatch<SetStateAction<EnrichedContent | undefined>>;
	setEnrichedCache: Dispatch<
		SetStateAction<{
			[tmdbID: number]: EnrichedContent;
		}>
	>;
	setHasBeenEnriched: Dispatch<SetStateAction<Set<string>>>;
}

const EPGContext = createContext<EPGContextType | undefined>(undefined);

export const EPGProvider: React.FC<{
	children: ReactNode;
	initialChannels: any[];
}> = ({ children, initialChannels }) => {
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

	const enrichContent = useCallback(async (basicContent: EnrichedContent) => {
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
				remainingRuntime: tmdbData.runtime,
				runtime: tmdbData.runtime
			};

			if (basicContent.type === "tv") {
				const episode = await getEpisode(enrichedContent, tmdbData);

				enrichedContent = {
					...enrichedContent,
					episodeName: episode.name,
					episodeNumber: episode.episode_number,
					overview: episode.overview,
					releaseDate: episode.air_date,
					remainingRuntime: episode.runtime,
					runtime: episode.runtime,
					seasonNumber: episode.season_number
				};
			}

			setEnrichedCache((prev) => ({
				...prev,
				[basicContent.type === "movie" || !basicContent.episodeTMDBID
					? basicContent.tmdbID
					: basicContent.episodeTMDBID]: enrichedContent
			}));
		} catch (error) {
			console.error("Error fetching TMDB details:", error);
		}
	}, []);

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
		setCurrentChannelIndex,
		setCurrentContent,
		setEnrichedCache,
		setHasBeenEnriched
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
