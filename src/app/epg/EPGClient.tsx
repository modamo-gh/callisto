"use client";

import { useEffect, useState } from "react";

interface EPGClientProps {
	initialData: any;
}

const EPGClient = ({ initialData }: EPGClientProps) => {
	const [currentChannel, setCurrentChannel] = useState(0);
	const [trendingMovies] = useState(initialData);

	const channels = ["A", "B", "C", "D"];

	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setCurrentChannel((prev) =>
					prev - 1 < 0 ? channels.length - 1 : prev - 1
				);
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				setCurrentChannel((prev) => (prev + 1) % channels.length);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [channels.length]);

	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center w-screen">
			<div className="flex flex-1 gap-2 w-full">
				<div className="bg-red-500 flex-1 rounded"></div>
				<div className="bg-blue-500 flex-1 rounded"></div>
			</div>
			<div className="flex flex-col flex-1 gap-2 px-2 pb-2 w-full">
				{[
					channels[
						currentChannel - 1 < 0
							? channels.length - 1
							: currentChannel - 1
					],
					channels[currentChannel],
					channels[(currentChannel + 1) % channels.length]
				].map((channel, index) => (
					<div
						className="bg-slate-700 flex-1 rounded w-full"
						key={index}
					>
						{channel}
					</div>
				))}
			</div>
		</div>
	);
};

export default EPGClient;
