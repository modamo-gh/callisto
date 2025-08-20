"use client";

import { Poppins } from "next/font/google";
import { useEffect } from "react";
import ChannelGuide from "./components/ChannelGuide";
import InfoPane from "./components/InfoPane";
import TimeMarkers from "./components/TimeMarkers";
import VideoPane from "./components/VideoPane";
import { BasicContent, EPGProvider, useEPG } from "./context/EPGContext";

interface EPGClientProps {
	initialData: any;
}

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EPGContent = () => {
	const { channels, currentChannelIndex, enrichContent } = useEPG();

	useEffect(() => {
		const viewableChannels = [
			channels[
				currentChannelIndex - 1 < 0
					? channels.length - 1
					: currentChannelIndex - 1
			],
			channels[currentChannelIndex],
			channels[(currentChannelIndex + 1) % channels.length]
		];

		for (const viewableChannel of viewableChannels) {
			for (const content of viewableChannel.data) {
				let basicContent: BasicContent;

				if (viewableChannel.type === "movies") {
					basicContent = {
						title: content.title || content.movie.title,
						tmdbID: content.ids?.tmdb || content.movie.ids.tmdb,
						type: "movie"
					};
				} else {
					basicContent = {
						title: content.show?.title,
						tmdbID: content.show.ids.tmdb,
						type: "tv"
					};
				}

				enrichContent(basicContent);
			}
		}
	}, [channels, currentChannelIndex, enrichContent]);

	return (
		<div
			className={`bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center p-2 ${poppins.className} w-screen`}
		>
			<div className="flex flex-1 gap-2 w-full">
				<InfoPane />
				<VideoPane />
			</div>
			<TimeMarkers />
			<ChannelGuide />
		</div>
	);
};

const EPGClient = ({ initialData }: EPGClientProps) => {
	return (
		<EPGProvider initialChannels={initialData}>
			<EPGContent />
		</EPGProvider>
	);
};

export default EPGClient;
