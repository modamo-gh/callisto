import { Episode, EpisodeMeta } from "@/app/lib/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEPG } from "../context/EPGContext";

const ChannelGuide = () => {
	const {
		channels,
		currentChannelIndex,
		ensureProgramMeta,
		getProgramMeta,
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
	});

	useEffect(() => {
		const fetchMeta = async () => {
			const channelsToProcess = [
				channels[
					currentChannelIndex - 1 < 0
						? channels.length - 1
						: currentChannelIndex - 1
				],
				channels[currentChannelIndex],
				channels[(currentChannelIndex + 1) % channels.length]
			];

			for (const channel of channelsToProcess) {
				const { programs } = channel;
				
				for (let i = 0; i < programs.length; i++) {
					await ensureProgramMeta(i, programs[i]);
				}
			}
		};

		fetchMeta();
	}, [channels, currentChannelIndex, ensureProgramMeta]);

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
						{channel.name}
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
						{channel.programs.map(
							(program, programIndex: number) => {
								const meta = getProgramMeta(program);
								const remainingRuntime = meta?.runtime;
								const programPixelWidth = remainingRuntime
									? (remainingRuntime / 120) * containerWidth
									: containerWidth / 4;

								return (
									<div
										className="bg-slate-700 flex flex-col flex-shrink-0 justify-center p-2 rounded text-xl"
										key={programIndex}
										style={{
											width: `${programPixelWidth}px`
										}}
									>
										<p className="truncate">
											{program.title}
										</p>
										{program.kind === "episode" && (
											<p className="text-sm truncate">
												S
												{String(
													(program as Episode).season
												).padStart(2, "0")}
												E
												{String(
													(program as Episode).number
												).padStart(2, "0")}
												:{" "}
												{
													(program as Episode)
														.episodeTitle
												}
											</p>
										)}
										{program.kind === "tv" && (
											<p className="text-sm truncate">
												S
												{String(
													(meta as EpisodeMeta)
														?.season
												).padStart(2, "0")}
												E
												{String(
													(meta as EpisodeMeta)
														?.episodeNumber
												).padStart(2, "0")}
												:{" "}
												{
													(meta as EpisodeMeta)
														?.episodeTitle
												}
											</p>
										)}
									</div>
								);
							}
						)}
					</div>
				</div>
			))}
		</div>
	);
};

export default ChannelGuide;
