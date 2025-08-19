"use client";

import { Poppins } from "next/font/google";
import { useEffect, useState } from "react";
import ChannelGuide from "./components/ChannelGuide";

interface EPGClientProps {
	initialData: any;
}

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EPGClient = ({ initialData }: EPGClientProps) => {
	const [channels] = useState(initialData);
	const [currentChannel, setCurrentChannel] = useState(0);

	const [movieDetails, setMovieDetails] = useState();

	const [timeMarkers, setTimeMarkers] = useState<
		{ date: Date; time: string }[]
	>([]);

	useEffect(() => {
		const updateTimeMarkers = () => {
			const roundedMS = Math.floor(Date.now() / 60000) * 60000;
			const roundedNow = new Date(roundedMS);
			const timeMarkers = [
				{
					date: roundedNow,
					time: roundedNow.toLocaleTimeString([], {
						hour: "2-digit",
						hour12: true,
						minute: "2-digit"
					})
				}
			];
			const currentMinutes = roundedNow.getMinutes();
			const minutesToNext30 =
				(currentMinutes < 30 ? 30 : 60) - currentMinutes;

			for (let i = 0; i < 3; i++) {
				const time = new Date(
					roundedNow.getTime() + (minutesToNext30 + i * 30) * 60000
				);

				timeMarkers.push({
					date: time,
					time: time.toLocaleTimeString([], {
						hour: "2-digit",
						hour12: true,
						minute: "2-digit"
					})
				});
			}

			setTimeMarkers(timeMarkers);
		};

		updateTimeMarkers();

		const msUntilNextMinute = 60000 - (Date.now() % 60000);

		const syncTimeout = setTimeout(() => {
			updateTimeMarkers();

			const interval = setInterval(() => {
				updateTimeMarkers();
			}, 60000);

			window.epgInterval = interval;
		}, msUntilNextMinute);

		return () => {
			clearTimeout(syncTimeout);

			if (window.epgInterval) {
				clearInterval(window.epgInterval);

				delete window.epgInterval;
			}
		};
	}, []);

	const [timeBracketIndex, setTimeBracketIndex] = useState(0);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					setCurrentChannel((prev) =>
						prev - 1 < 0 ? channels.length - 1 : prev - 1
					);
					break;
				case "ArrowDown":
					event.preventDefault();
					setCurrentChannel((prev) => (prev + 1) % channels.length);
					break;
				case "ArrowLeft":
					setTimeBracketIndex((prev) =>
						prev - 1 < 0 ? 0 : prev - 1
					);
					break;
				case "ArrowRight":
					setTimeMarkers((prev) => {
						const markers = [...prev];
						const nextDate = new Date(
							markers[markers.length - 1].date.getTime() +
								30 * 60000
						);
						markers.push({
							date: nextDate,
							time: nextDate.toLocaleTimeString([], {
								hour: "2-digit",
								hour12: true,
								minute: "2-digit"
							})
						});

						return markers;
					});
					setTimeBracketIndex((prev) => prev + 1);
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [channels.length, timeBracketIndex]);

	useEffect(() => {
		// const fetchMovieDetails = async (tmdbID: number) => {
		// 	try {
		// 		const response = await fetch(
		// 			`https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
		// 		);
		// 		if (!response.ok) {
		// 			throw new Error("Failed to fetch");
		// 		}
		// 		const data = await response.json();
		// 		setMovieDetails(data);
		// 	} catch (error) {
		// 		console.error("Error fetching movie details:", error);
		// 	}
		// };
		// fetchMovieDetails(
		// 	channels[currentChannel].channelName === "Most Popular Movies"
		// 		? channels[currentChannel].data[0].ids.tmdb
		// 		: channels[currentChannel].data[0].movie.ids.tmdb
		// );
	}, [channels, currentChannel]);

	return (
		<div
			className={`bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center p-2 ${poppins.className} w-screen`}
		>
			<div className="flex flex-1 gap-2 w-full">
				<div className="bg-slate-700 flex flex-col flex-1 gap-4 p-6 rounded">
					{/* <h1 className="text-4xl font-bold">
						{movieDetails?.title}
					</h1>
					<div className="flex flex-wrap gap-2 uppercase text-slate-300">
						{movieDetails?.genres.map((genre, index: number) => (
							<div
								className="bg-slate-600 px-3 py-1 rounded-full tracking-wider"
								key={index}
							>
								{genre.name}
							</div>
						))}
					</div>
					<p className="text-slate-200 leading-relaxed max-h-[150px]">
						{movieDetails?.overview}
					</p>
					<div className="flex gap-6 mt-auto text-slate-400">
						<p>⏱ {movieDetails?.runtime} mins</p>
						<p>📅 {movieDetails?.release_date}</p>
					</div> */}
				</div>
				<div className="bg-blue-500 flex-1 rounded"></div>
			</div>
			<div className="flex gap-2 justify-around w-full">
				<div className="flex-1" />
				{timeMarkers
					.slice(timeBracketIndex, timeBracketIndex + 4)
					.map((marker, index) => (
						<div
							className="flex-1"
							key={index}
						>
							{marker.time}
						</div>
					))}
			</div>
			<ChannelGuide
				channels={channels}
				currentChannel={currentChannel}
			/>
		</div>
	);
};

export default EPGClient;
