import { useLayoutEffect, useRef, useState } from "react";

interface ChannelGuideProps {
	channels: any;
	currentChannel: number;
}

const getRandomEpisode = async (tmdbID: number) => {
	try {
		const response = await fetch(
			`https://api.themoviedb.org/3/tv/${tmdbID}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
		);

		if (!response.ok) {
			throw new Error("Failed to fetch");
		}

		const data = await response.json();
		const seasons = data.seasons.filter((season) => season.season_number);
		const randomSeason =
			seasons[Math.floor(Math.random() * seasons.length)].season_number;
		const randomSeasonResponse = await fetch(
			`https://api.themoviedb.org/3/tv/${tmdbID}/season/${randomSeason}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
		);
		const randomSeasonInfo = await randomSeasonResponse.json();
		const releasedEpisodes = randomSeasonInfo.episodes.filter(
			(episode) => Date.now() >= new Date(episode.air_date).getTime()
		);
		const randomEpisode =
			releasedEpisodes[
				Math.floor(Math.random() * releasedEpisodes.length)
			];

		return randomEpisode;
	} catch (error) {
		console.error("Error fetching random episode:", error);
	}
};

const ChannelGuide = ({ channels, currentChannel }: ChannelGuideProps) => {
	const contentContainerRef = useRef<HTMLDivElement>(null);

	const [containerWidth, setContainerWidth] = useState(0);
	const [movieRuntimes, setMovieRuntimes] = useState<{
		[key: number]: number;
	}>({});
	const [showEpisodes, setShowEpisodes] = useState<{ [tmdbID: number]: any }>(
		{}
	);

	const fetchRuntime = async (tmdbID: number): Promise<number | null> => {
		if (movieRuntimes[tmdbID]) {
			return movieRuntimes[tmdbID];
		}

		try {
			const response = await fetch(
				`https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
			);

			if (!response.ok) {
				throw new Error("Failed to fetch");
			}

			const data = await response.json();
			const runtime = data.runtime || 0;

			setMovieRuntimes((prev) => ({ ...prev, [tmdbID]: runtime }));

			return runtime;
		} catch (error) {
			console.error("Error fetching runtime:", error);

			return null;
		}
	};

	useLayoutEffect(() => {
		const measureWidth = () => {
			if (contentContainerRef.current) {
				setContainerWidth(contentContainerRef.current.offsetWidth);
			}
		};

		measureWidth();

		window.addEventListener("resize", measureWidth);

		return () => window.removeEventListener("resize", measureWidth);
	}, []);

	return (
		<div className="flex flex-col flex-1 gap-2 w-full">
			{[
				channels[
					currentChannel - 1 < 0
						? channels.length - 1
						: currentChannel - 1
				],
				channels[currentChannel],
				channels[(currentChannel + 1) % channels.length]
			].map((channel, channelIndex) => (
				<div
					className="flex flex-1 gap-2 rounded w-full"
					key={channelIndex}
				>
					<div className="bg-slate-700 flex items-center justify-center rounded text-center w-1/5">
						{channel.channelName}
					</div>
					<div
						className="flex gap-2 no-scrollbar overflow-x-auto w-4/5"
						ref={contentContainerRef}
						style={{ scrollbarWidth: "none" }}
					>
						{channel.data.map((content, contentIndex: number) => {
							if (channel.type === "movies") {
								const movie =
									channel.channelName ===
									"Most Popular Movies"
										? content
										: content.movie;
								const runtime = movie.ids.tmdb
									? movieRuntimes[movie.ids.tmdb]
									: null;

								if (movie.ids.tmdb && runtime === undefined) {
									fetchRuntime(movie.ids.tmdb);
								}

								const contentPixelWidth = runtime
									? (runtime / 120) * containerWidth
									: containerWidth / 4;

								return (
									<div
										className="bg-slate-700 flex flex-shrink-0 items-center p-2 rounded text-xl"
										key={contentIndex}
										style={{
											width: `${contentPixelWidth}px`
										}}
									>
										<p className="text-white truncate">
											{movie.title}
										</p>
									</div>
								);
							} else {
								const tmdbID = content.show.ids.tmdb;

								if (!showEpisodes[tmdbID]) {
									getRandomEpisode(tmdbID).then((episode) => {
										if (episode) {
											setShowEpisodes((prev) => ({
												...prev,
												[tmdbID]: episode
											}));
										}
									});

									return (
										<div
											className="bg-slate-700 flex flex-shrink-0 items-center p-2 rounded text-xl"
											key={contentIndex}
											style={{
												width: `${containerWidth / 4}px`
											}}
										>
											<p className="text-white truncate">
												Loading...
											</p>
										</div>
									);
								}

								const episode = showEpisodes[tmdbID];
								const contentPixelWidth = episode.runtime
									? (episode.runtime / 120) * containerWidth
									: containerWidth / 4;

								return (
									<div
										className="bg-slate-700 flex flex-col flex-shrink-0 justify-center p-2 rounded text-xl"
										key={contentIndex}
										style={{
											width: `${contentPixelWidth}px`
										}}
									>
										<p className="text-white truncate">
											{content.show.title}
										</p>
										<p className="text-white truncate">
											{episode.name}
										</p>
									</div>
								);
							}
						})}
					</div>
				</div>
			))}
		</div>
	);
};

export default ChannelGuide;
