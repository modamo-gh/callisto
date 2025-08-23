"use client";

import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { EPGClientProps } from "../lib/types";
import ChannelGuide from "./components/ChannelGuide";
import InfoPane from "./components/InfoPane";
import TimeMarkers from "./components/TimeMarkers";
import VideoPane from "./components/VideoPane";
import { EPGProvider, useEPG } from "./context/EPGContext";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EPGContent = () => {
	const { channels, currentChannelIndex, getProgramMeta, tmdbCache } =
		useEPG();

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

		for (const channel of viewableChannels) {
			for (let i = 0; i < channel.programs.length; i++) {
				const program = channel.programs[i];

				if (!tmdbCache.has(program.tmdb)) {
					getProgramMeta(i, program);
				}

				// if (hasBeenEnriched.has(`${viewableChannel.name}`)) {
				// 	continue;
				// }

				// for (let i = 0; i < viewableChannel.programs.length; i++) {
				// 	const id = `${Date.now()}-${Math.random()
				// 		.toString(36)
				// 		.substring(2, 9)}`;

				// 	const program = viewableChannel.programs[i];

				// 	let basicContent: EnrichedContent;

				// 	if (viewableChannel.type === "movies") {
				// 		basicContent = {
				// 			id,
				// 			title: program.title,
				// 			tmdb: program.tmdb,
				// 			type: "movie"
				// 		};
				// 	} else {
				// 		basicContent = {
				// 			episodeName: program.episode?.title,
				// 			episodeNumber: program.episode?.number,
				// 			episodeTMDBID: program.episode?.ids.tmdb,
				// 			id,
				// 			seasonNumber: program.episode?.season,
				// 			title: program.show?.title || program.title,
				// 			tmdb: program.tmdb,
				// 			type: "tv"
				// 		};
				// 	}

				// 	enrichContent(basicContent, i === 0);
				// }

				// setHasBeenEnriched(() => {
				// 	const set = new Set<string>(hasBeenEnriched);

				// 	set.add(`${viewableChannel.name}`);

				// 	return set;
				// });
			}
		}
	}, [channels, currentChannelIndex, getProgramMeta, tmdbCache]);

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

const EPGClient = ({ channels }: EPGClientProps) => {
	return (
		<EPGProvider channels={channels}>
			<EPGContent />
		</EPGProvider>
	);
};

export default EPGClient;
