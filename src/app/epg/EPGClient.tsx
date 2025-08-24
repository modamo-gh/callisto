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
		fetchEpisodeMeta,
		fetchMovieMeta,
		getProgramMeta,
		fetchShowTMDB,
		movieMetaCache,
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
							fetchMovieMeta(i, program);
						}

						break;
					case "episode":
						const episode = program as Episode;

						if (!episodeMetaCache.has(episode.episodeTMDB)) {
							fetchEpisodeMeta(i, episode);
						}

						break;
					case "tv":
						const show = program as Show;

						if (!showMetaCache.has(program.tmdb)) {
							fetchShowTMDB(i, show)
								.then(() => {
									if (!show.episodeTMDB) {
										fetchEpisodeTMDB(show)
											.then((episodeTMDB) => {
												if (episodeTMDB) {
													show.episodeTMDB =
														episodeTMDB.id;
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
						} else if (!show.episodeTMDB) {
							if (!show.episodeTMDB) {
								fetchEpisodeTMDB(show)
									.then((episodeTMDB) => {
										if (episodeTMDB) {
											show.episodeTMDB = episodeTMDB.id;
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
		fetchEpisodeMeta,
		fetchEpisodeTMDB,
		fetchMovieMeta,
		fetchShowTMDB,
		getProgramMeta,
		movieMetaCache,
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
