"use client";

import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
	subsets: ["latin"],
	weight: ["400", "700", "900"]
});

const Home = () => {
	const handleTraktLogin = () => {
		const clientID = process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID;
		const redirectURI = encodeURIComponent(process.env.NEXT_PUBLIC_TRAKT_REDIRECT_URI)
		const traktAuthURL = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectURI}`;

		window.location.href = traktAuthURL;
	}
	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center relative w-screen">
			<div className="absolute inset-0 pointer-events-none">
				<div className="scan-line absolute w-full h-1 bg-cyan-400/30 blur-sm"></div>
			</div>
			<h1
				className={`${orbitron.className} text-center text-cyan-500 text-9xl tracking-widest`}
			>
				neocable
			</h1>
			<h2
				className={`${orbitron.className} text-center text-cyan-500 text-4xl tracking-wide`}
			>
				Combining the comfort of cable with the convenience of streaming
			</h2>
			<button
				className={`${orbitron.className} bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 font-bold text-slate-100 px-6 py-3 rounded tracking-wide transition-colors`}
				onClick={handleTraktLogin}
			>
				Sign in with Trakt
			</button>
		</div>
	);
};

export default Home;
