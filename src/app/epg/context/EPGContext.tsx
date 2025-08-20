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

interface EnrichedContent extends BasicContent {
	episodeName?: string;
	episodeNumber?: number;
	genres: string[];
	overview: string;
	releaseDate: string;
	remainingRuntime: number;
	runtime: number;
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

	const enrichContent = useCallback(async (basicContent: BasicContent) => {
		if (enrichedCache[basicContent.tmdbID]) {
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
				const episode = await getRandomEpisode(
					enrichedContent.tmdbID,
					tmdbData
				);

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
				[enrichedContent.tmdbID]: enrichedContent
			}));
		} catch (error) {
			console.error("Error fetching TMDB details:", error);
		}
	}, []);

	const getRandomEpisode = useCallback(
		async (tmdbID: number, showData: any) => {
			try {
				const seasons = showData.seasons.filter(
					(season) => season.season_number
				);
				const randomSeason =
					seasons[Math.floor(Math.random() * seasons.length)]
						.season_number;
				const randomSeasonResponse = await fetch(
					`https://api.themoviedb.org/3/tv/${tmdbID}/season/${randomSeason}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
				);
				const randomSeasonInfo = await randomSeasonResponse.json();
				const releasedEpisodes = randomSeasonInfo.episodes.filter(
					(episode) =>
						Date.now() >= new Date(episode.air_date).getTime()
				);
				const randomEpisode =
					releasedEpisodes[
						Math.floor(Math.random() * releasedEpisodes.length)
					];

				return randomEpisode;
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
