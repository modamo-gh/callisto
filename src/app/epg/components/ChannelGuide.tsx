import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEPG } from "../context/EPGContext";

const ChannelGuide = () => {
	const {
		channels,
		currentChannelIndex,
		enrichedCache,
		setCurrentChannelIndex
	} = useEPG();

	const contentContainerRef = useRef<HTMLDivElement>(null);

	const [containerWidth, setContainerWidth] = useState(0);

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

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					setCurrentChannelIndex((prev) =>
						prev - 1 < 0 ? channels.length - 1 : prev - 1
					);
					break;
				case "ArrowDown":
					event.preventDefault();
					setCurrentChannelIndex(
						(prev) => (prev + 1) % channels.length
					);
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [channels.length, currentChannelIndex, setCurrentChannelIndex]);

	return (
		<div className="flex flex-col flex-1 gap-2 w-full">
			{[
				channels[
					currentChannelIndex - 1 < 0
						? channels.length - 1
						: currentChannelIndex - 1
				],
				channels[currentChannelIndex],
				channels[(currentChannelIndex + 1) % channels.length]
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
							const c =
								enrichedCache[
									content.ids?.tmdb ||
										content.movie?.ids.tmdb ||
										content.show.ids.tmdb
								];

							const contentPixelWidth = c?.runtime
								? (c.runtime / 120) * containerWidth
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
										{c?.title}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
};

export default ChannelGuide;
