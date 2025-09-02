"use client";

import { Orbitron } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const orbitron = Orbitron({
	subsets: ["latin"],
	weight: ["400", "700", "900"]
});

const Home = () => {
	const [rdError, setRDError] = useState<string | null>(null);
	const [traktAuthed, setTraktAuthed] = useState(false);
	const [realDebridAuthed, setRealDebridAuthed] = useState(false);
	const [realDebridBusy, setRealDebridBusy] = useState(false);

	const handleRDAuth = async () => {
		setRDError(null);
		setRealDebridBusy(true);

		try {
			const response = await fetch("/api/auth/rd/start");

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const start = (await response.json()) as {
				device_code: string;
				verification_url: string;
				direct_verification_url?: string;
				interval: number;
				expires_in: number;
			};

			window.open(
				start.direct_verification_url ?? start.verification_url,
				"_blank"
			);

			const device_code = start.device_code;
			const intervalMs = Math.max(1000, (start.interval ?? 5) * 1000);
			const deadline = Date.now() + (start.expires_in ?? 1800) * 1000;

			const tick = async () => {
				if (Date.now() > deadline) {
					throw new Error("Device code expired. Try again.");
				}

				const credentialsResponse = await fetch(
					"/api/auth/rd/credentials",
					{
						body: JSON.stringify({ device_code }),
						headers: { "content-type": "application/json" },
						method: "POST"
					}
				);

				if (credentialsResponse.status === 202) {
					return false;
				}

				if (!credentialsResponse.ok) {
					{
						throw new Error(
							(await credentialsResponse.text()) ||
								"Real-Debrid credentials polling failed"
						);
					}
				}

				const tokenResponse = await fetch("/api/auth/rd/token", {
					body: JSON.stringify({ device_code }),
					headers: { "content-type": "application/json" },
					method: "POST"
				});

				if (!tokenResponse.ok) {
					throw new Error(await tokenResponse.text());
				}

				const me = await fetch("/api/me", { cache: "no-store" }).then(
					(response) => response.json()
				);

				setRealDebridAuthed(!!me.realDebridAuthed);
				setTraktAuthed(!!me.traktAuthed);

				return true;
			};

			let timer: number | undefined;

			const loop = async () => {
				try {
					const done = await tick();

					if (!done) {
						timer = window.setTimeout(loop, intervalMs);
					} else {
						setRealDebridBusy(false);
					}
				} catch (error: any) {
					setRDError(error?.message ?? "Authorization failed");
					setRealDebridBusy(false);
				}
			};

			loop();

			return () => {
				if (timer) {
					window.clearTimeout(timer);
				}
			};
		} catch (error: any) {
			setRDError(error?.message ?? "Failed to start Real-Debrid auth");
			setRealDebridBusy(false);
		}
	};

	const router = useRouter();

	useEffect(() => {
		if (traktAuthed && realDebridAuthed) {
			router.push("/epg");
		}
	}, [realDebridAuthed, router, traktAuthed]);

	const handleTraktAuth = async () => {
		try {
			const response = await fetch("/api/auth/trakt/start", {
				cache: "no-store"
			});

			if (!response.ok) {
				console.error(await response.text());

				return;
			}

			const { url } = await response.json();

			window.location.href = url;
		} catch (error) {
			console.error("Failed to start Trakt auth:", error);
		}
	};

	useEffect(() => {
		(async () => {
			try {
				const response = await fetch("/api/me", { cache: "no-store" });

				if (response.ok) {
					const { traktAuthed, realDebridAuthed } =
						await response.json();

					setTraktAuthed(traktAuthed);
					setRealDebridAuthed(realDebridAuthed);
				}
			} catch (error) {
				console.error("Failed to fetch /me:", error);
			}
		})();
	}, []);

	return (
		<div className="flex flex-col h-screen relative w-screen">
			<div
				className="absolute bg-cover inset-0"
				style={{ backgroundImage: "url('/nebula.jpg')" }}
			/>
			<div className="absolute bg-[linear-gradient(to_right,black_0%,black_30%,transparent_100%)] inset-0" />
			<div
				className={`absolute grid grid-cols-2 grid-rows-10 inset-0 ${orbitron.className} z-10`}
			>
				<header className="flex col-span-2 items-center justify-start p-8 row-span-1">
					<h1 className="font-semibold text-center text-cyan-500 text-2xl tracking-widest">
						callisto
					</h1>
				</header>
				<main className="col-span-1 flex flex-col gap-4 items-center row-span-8">
					<div className="flex flex-col flex-4 gap-8 items-center justify-center text-cyan-500 text-4xl">
						<h2>Just like cable</h2>
						<h2>Just for you</h2>
					</div>
					<div className="flex flex-col flex-1 items-center justify-around w-full">
						<button
							className={`${
								orbitron.className
							} font-bold text-slate-100 px-6 py-3 rounded tracking-wide ${
								traktAuthed
									? "bg-slate-700"
									: "bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 transition-colors"
							} w-4/5`}
							disabled={traktAuthed}
							onClick={handleTraktAuth}
						>
							Trakt Authorized {!traktAuthed ? "❌" : "✅"}
						</button>
						<button
							className={`${
								orbitron.className
							} font-bold px-6 py-3 rounded text-slate-100 tracking-wide ${
								realDebridAuthed
									? "bg-slate-700"
									: "bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 transition-colors"
							} w-4/5`}
							disabled={realDebridAuthed}
							onClick={handleRDAuth}
						>
							Real Debrid Authorized{" "}
							{!realDebridAuthed ? "❌" : "✅"}
						</button>
					</div>
				</main>
				<aside className="col-span-1 row-span-8" />
				<div className="flex col-span-2 items-center justify-center row-span-1">
					<p>Envisioned and Engineered by Modamo Studios</p>
				</div>
			</div>
		</div>
	);
};

export default Home;
