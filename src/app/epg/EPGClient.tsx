"use client";

import { Poppins } from "next/font/google";
import { useEffect } from "react";
import { EPGClientProps, Episode, Show } from "../lib/types";
import ChannelGuide from "./components/ChannelGuide";
import InfoPane from "./components/InfoPane";
import TimeMarkers from "./components/TimeMarkers";
import VideoPane from "./components/VideoPane";
import { EPGProvider, useEPG } from "./context/EPGContext";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EPGContent = () => {
	const {
		channels,
		currentChannelIndex,
		episodeMetaCache,
		fetchEpisodeTMDB,
		getEpisodeMeta,
		getMovieMeta,
		getProgramMeta,
		getShowMeta,
		movieMetaCache,
		programMetaCache,
		showMetaCache
	} = useEPG();

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

				switch (program.kind) {
					case "movie":
						if (!movieMetaCache.has(program.tmdb)) {
							getMovieMeta(i, program);
						}

						break;
					case "episode":
						if (!episodeMetaCache.has(program.tmdb)) {
							getEpisodeMeta(i, program as Episode);
						}

						break;
					case "tv":
						if (!showMetaCache.has(program.tmdb)) {
							getShowMeta(i, program as Show)
								.then(() => {
									if (!(program as Show).episodeTMDB) {
										fetchEpisodeTMDB(program as Show)
											.then((episodeID) => {
												if (episodeID) {
													(
														program as Show
													).episodeTMDB = episodeID;
												}
											})
											.catch((error) =>
												console.error(
													"Error fetching episode TMDB:",
													error
												)
											);
									}
								})
								.catch((error) =>
									console.error(
										"Error fetching show meta:",
										error
									)
								);
						} else if (!(program as Show).episodeTMDB) {
							if (!(program as Show).episodeTMDB) {
								fetchEpisodeTMDB(program as Show)
									.then((episodeID) => {
										if (episodeID) {
											(program as Show).episodeTMDB =
												episodeID;
										}
									})
									.catch((error) =>
										console.error(
											"Error fetching episode TMDB:",
											error
										)
									);
							}
						}

						break;
				}
			}
		}
	}, [
		channels,
		currentChannelIndex,
		episodeMetaCache,
		fetchEpisodeTMDB,
		getEpisodeMeta,
		getMovieMeta,
		getProgramMeta,
		getShowMeta,
		movieMetaCache,
		programMetaCache,
		showMetaCache
	]);

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
