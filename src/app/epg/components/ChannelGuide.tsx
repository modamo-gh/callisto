import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEPG } from "../context/EPGContext";

const ChannelGuide = () => {
	const {
		channels,
		currentChannelIndex,
		enrichedCache,
		runtimeTracker,
		setCurrentChannelIndex
	} = useEPG();

	const contentContainerRefs = useRef<(HTMLDivElement | null)[]>([
		null,
		null,
		null
	]);
	const measureRef = useRef<HTMLDivElement>(null);

	const [containerWidth, setContainerWidth] = useState(0);

	useLayoutEffect(() => {
		const measureWidth = () => {
			if (measureRef.current) {
				setContainerWidth(measureRef.current?.offsetWidth);
			}
		};

		measureWidth();

		window.addEventListener("resize", measureWidth);

		return () => window.removeEventListener("resize", measureWidth);
	}, []);

	const scrollHorizontal = (direction: "left" | "right") => {
		const scrollAmount = containerWidth / 4;

		contentContainerRefs.current.forEach((ref) => {
			if (ref) {
				const currentScroll = ref.scrollLeft;
				const newScrollPosition =
					direction === "right"
						? currentScroll + scrollAmount
						: currentScroll - scrollAmount;

				ref.scrollTo({
					behavior: "smooth",
					left: Math.max(0, newScrollPosition)
				});
			}
		});
	};

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
				case "ArrowLeft":
					event.preventDefault();
					scrollHorizontal("left");
					break;
				case "ArrowRight":
					event.preventDefault();
					scrollHorizontal("right");
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [
		channels.length,
		containerWidth,
		currentChannelIndex,
		setCurrentChannelIndex
	]);

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
						ref={(el) => {
							contentContainerRefs.current[channelIndex] = el;

							if (channelIndex === 0) {
								measureRef.current = el;
							}
						}}
						style={{ scrollbarWidth: "none" }}
					>
						{channel.data.map((content, contentIndex: number) => {
							const c =
								enrichedCache[
									content.episode?.ids.tmdb ||
										content.ids?.tmdb ||
										content.movie?.ids.tmdb ||
										content.show.ids.tmdb
								];
							const remainingRuntime =
								runtimeTracker.get(c?.id) || c?.runtime;
							const contentPixelWidth = remainingRuntime
								? (remainingRuntime / 120) * containerWidth
								: containerWidth / 4;

							return (
								<div
									className="bg-slate-700 flex flex-col flex-shrink-0 justify-center p-2 rounded text-xl"
									key={contentIndex}
									style={{
										width: `${contentPixelWidth}px`
									}}
								>
									<p className="truncate">{c?.title}</p>
									{c?.type === "tv" && (
										<p className="text-sm truncate">
											S
											{String(c.seasonNumber).padStart(
												2,
												"0"
											)}
											E
											{String(c.episodeNumber).padStart(
												2,
												"0"
											)}
											: {c.episodeName}
										</p>
									)}
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
