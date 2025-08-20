import { useEffect, useMemo, useRef, useState } from "react";

const MIN = 60000;

const floorNowToMinute = (d: Date) => {
	return new Date(Math.floor(d.getTime() / MIN) * MIN);
};

const TimeMarkers = () => {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [now, setNow] = useState(() => floorNowToMinute(new Date()));
	const [timeMarkerIndex, setTimeMarkerIndex] = useState(0);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "ArrowLeft":
					setTimeMarkerIndex((prev) => (prev - 1 < 0 ? 0 : prev - 1));
					break;
				case "ArrowRight":
					setTimeMarkerIndex((prev) => prev + 1);
					break;
				default:
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	useEffect(() => {
		const sync = () => setNow(floorNowToMinute(new Date()));
		const msUntilNextMinute = MIN - (Date.now() % MIN);

		timeoutRef.current = setTimeout(() => {
			sync();

			intervalRef.current = setInterval(sync, MIN);
		}, msUntilNextMinute);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}

			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	const timeMarkers = useMemo(() => {
		const firstMarker = now;
		const minutes = now.getMinutes();
		const minutesToNext30 = (minutes < 30 ? 30 : 60) - minutes;
		const secondMarker = new Date(now.getTime() + minutesToNext30 * MIN);
		const neededAmountOfMarkers = timeMarkerIndex + 4;
		const markers: { date: Date; time: string; key: number }[] = [];

		const formatTime = (d: Date) => {
			return d.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
				hour12: true
			});
		};

		markers.push({
			date: firstMarker,
			time: formatTime(firstMarker),
			key: firstMarker.getTime()
		});

		markers.push({
			date: secondMarker,
			time: formatTime(secondMarker),
			key: secondMarker.getTime()
		});

		while (markers.length < neededAmountOfMarkers) {
			const last = markers[markers.length - 1].date;
			const next = new Date(last.getTime() + 30 * MIN);

			markers.push({
				date: next,
				time: formatTime(next),
				key: next.getTime()
			});
		}

		return markers;
	}, [now, timeMarkerIndex]);

	return (
		<div className="flex gap-2 justify-around w-full">
			<div className="flex-1" />
			{timeMarkers
				.slice(timeMarkerIndex, timeMarkerIndex + 4)
				.map((marker) => (
					<div
						className="flex-1"
						key={marker.key}
					>
						{marker.time}
					</div>
				))}
		</div>
	);
};

export default TimeMarkers;
