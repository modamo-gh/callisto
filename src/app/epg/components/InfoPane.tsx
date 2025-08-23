import { useEPG } from "../context/EPGContext";

const InfoPane = () => {
	const { channels, currentChannelIndex, tmdbCache } = useEPG();

	const program = channels[currentChannelIndex].programs[0];
	const meta = tmdbCache.get(program.tmdb);

	return (
		<div className="bg-slate-700 flex flex-col flex-1 gap-4 p-6 rounded">
			<h1 className="text-4xl font-bold">{program.title}</h1>
			{/* {enrichedCurrentContent?.type === "tv" && (
				<h2 className="text-2xl font-semibold">
					S
					{String(enrichedCurrentContent.seasonNumber).padStart(
						2,
						"0"
					)}
					E
					{String(enrichedCurrentContent.episodeNumber).padStart(
						2,
						"0"
					)}
					: {enrichedCurrentContent.episodeName}
				</h2>
			)} */}
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
