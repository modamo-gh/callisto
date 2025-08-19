"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface EPGClientProps {
	initialData: any;
}

const EPGClient = ({ initialData }: EPGClientProps) => {
	const [channels] = useState(initialData);
	const [containerWidth, setContainerWidth] = useState(0);
	const [currentChannel, setCurrentChannel] = useState(0);
	const [movieRuntimes, setMovieRuntimes] = useState<{
		[key: number]: number;
	}>({});

	const contentContainerRef = useRef<HTMLDivElement>(null);

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

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setCurrentChannel((prev) =>
					prev - 1 < 0 ? channels.length - 1 : prev - 1
				);
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				setCurrentChannel((prev) => (prev + 1) % channels.length);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [channels.length]);

	const calculateTimeMarkers = () => {
		const now = new Date();
		const timeMarkers = [
			now.toLocaleTimeString([], {
				hour: "2-digit",
				hour12: true,
				minute: "2-digit"
			})
		];
		const currentMinutes = now.getMinutes();
		const minutesToNext30 =
			(currentMinutes < 30 ? 30 : 60) - currentMinutes;

		for (let i = 0; i < 3; i++) {
			const time = new Date(
				now.getTime() + (minutesToNext30 + i * 30) * 60000
			);

			timeMarkers.push(
				time.toLocaleTimeString([], {
					hour: "2-digit",
					hour12: true,
					minute: "2-digit"
				})
			);
		}

		return timeMarkers;
	};

	const [timeMarkers] = useState(calculateTimeMarkers());

	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center w-screen">
			<div className="flex flex-1 gap-2 w-full">
				<div className="bg-red-500 flex-1 rounded"></div>
				<div className="bg-blue-500 flex-1 rounded"></div>
			</div>
			<div className="flex gap-2 justify-around w-full">
				<div className="flex-1" />
				{timeMarkers.map((marker, index) => (
					<div
						className="flex-1"
						key={index}
					>
						{marker}
					</div>
				))}
			</div>
			<div className="flex flex-col flex-1 gap-2 px-2 pb-2 w-full">
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
						<div className="bg-slate-700 flex items-center justify-center rounded w-1/5">
							{channel.channelName}
						</div>
						<div
							className="flex gap-2 overflow-x-auto w-4/5"
							ref={contentContainerRef}
						>
							{channel.data.map(
								(content, contentIndex: number) => {
									const movie =
										channel.channelName ===
										"Most Popular Movies"
											? content
											: content.movie;
									const runtime = movie.ids.tmdb
										? movieRuntimes[movie.ids.tmdb]
										: null;

									if (
										movie.ids.tmdb &&
										runtime === undefined
									) {
										fetchRuntime(movie.ids.tmdb);
									}

									const contentPixelWidth = runtime
										? (runtime / 120) * containerWidth
										: containerWidth / 4;

									return (
										<div
											className="bg-slate-700 rounded p-2 flex-shrink-0"
											key={contentIndex}
											style={{
												width: `${contentPixelWidth}px`
											}}
										>
											<p className="text-white text-xs truncate">
												{movie.title}
											</p>
											<p className="text-gray-300 text-xs">
												{runtime || "Loading..."}
											</p>
										</div>
									);
								}
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default EPGClient;
