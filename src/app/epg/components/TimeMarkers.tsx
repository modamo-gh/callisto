import { useEffect, useState } from "react";
import { useEPG } from "../context/EPGContext";

const TimeMarkers = () => {
	const { channels } = useEPG();

	const [timeBracketIndex, setTimeBracketIndex] = useState(0);
	const [timeMarkers, setTimeMarkers] = useState<
		{ date: Date; time: string }[]
	>([]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
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

	return (
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
	);
};

export default TimeMarkers;
