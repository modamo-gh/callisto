"use client";

import { Poppins } from "next/font/google";
import { EPGClientProps } from "../lib/types";
import ChannelGuide from "./components/ChannelGuide";
import InfoPane from "./components/InfoPane";
import TimeMarkers from "./components/TimeMarkers";
import VideoPane from "./components/VideoPane";
import { EPGProvider } from "./context/EPGContext";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"] });

const EPGContent = () => {
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
