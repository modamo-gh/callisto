import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
	subsets: ["latin"],
	weight: ["400", "700", "900"]
});

const Home = () => {
	return (
		<div className="bg-slate-800 flex flex-col gap-2 h-screen items-center justify-center w-screen">
			<div className="absolute inset-0 pointer-events-none">
				<div className="scan-line absolute w-full h-1 bg-cyan-400/30 blur-sm"></div>
			</div>
			<h1
				className={`${orbitron.className} text-center text-cyan-500 text-9xl tracking-widest`}
			>
				neocable
			</h1>
			<h2
				className={`${orbitron.className} text-center text-cyan-500 text-4xl tracking-widest`}
			>
				Combining the comfort of cable with the convenience of streaming
			</h2>
		</div>
	);
};

export default Home;
