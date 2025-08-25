import { Episode, EpisodeMeta } from "@/app/lib/types";
import { useEPG } from "../context/EPGContext";
import { useEffect } from "react";

const InfoPane = () => {
	const { channels, currentChannelIndex, fetchProgramLink, getProgramMeta } =
		useEPG();

	const program = channels[currentChannelIndex].programs[0];

	const meta = getProgramMeta(program);

	useEffect(() => {
		if (!meta || meta.link) return;

		const testFetchLink = async () => {
			console.log(`Testing fetchProgramLink for: ${program.title}`);
			try {
				const link = await fetchProgramLink(program);
				console.log(`Got link:`, link);
			} catch (error) {
				console.error("Error fetching link:", error);
			}
		};

		const timeoutId = setTimeout(testFetchLink, 1000);
		return () => clearTimeout(timeoutId);
	}, [fetchProgramLink, meta, program]);

	return (
		<div className="bg-slate-700 flex flex-col flex-1 gap-4 p-6 rounded">
			<h1 className="text-4xl font-bold">{program.title}</h1>
			{program.kind !== "movie" && (
				<h2 className="text-2xl font-semibold">
					{program.kind === "episode"
						? `S${String((program as Episode)?.season).padStart(
								2,
								"0"
						  )}E
					${String((program as Episode)?.number).padStart(2, "0")}: ${
								(program as Episode)?.episodeTitle
						  }`
						: `S${String((meta as EpisodeMeta)?.season).padStart(
								2,
								"0"
						  )}E
					${String((meta as EpisodeMeta)?.episodeNumber).padStart(2, "0")}: ${
								(meta as EpisodeMeta)?.episodeTitle
						  }`}
				</h2>
			)}
			<div className="flex flex-wrap gap-2 uppercase text-slate-300">
				{meta?.genres &&
					meta.genres.map((genre, index: number) => (
						<div
							className="bg-slate-600 px-3 py-1 rounded-full tracking-wider"
							key={index}
						>
							{genre}
						</div>
					))}
			</div>
			<p className="text-slate-200 leading-relaxed max-h-[150px]">
				{meta?.overview}
			</p>
			<div className="flex gap-6 mt-auto text-slate-400">
				<p>⏱ {meta?.runtime} mins</p>
				<p>📅 {meta?.releaseDate}</p>
			</div>
		</div>
	);
};

export default InfoPane;
