"use client";

import { Orbitron } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Credentials, DeviceCode, Tokens } from "./lib/types";
import Image from "next/image";

const orbitron = Orbitron({
	subsets: ["latin"],
	weight: ["400", "700", "900"]
});

const Home = () => {
	const approvedRef = useRef(false);
	const exchangedRef = useRef(false);
	const pollRef = useRef<number | null>(null);

	const [rdCredentials, setRDCredentials] = useState<Credentials | null>(
		null
	);
	const [rdDevice, setRDDevice] = useState<DeviceCode | null>(null);
	const [rdError, setRDError] = useState<string | null>(null);
	const [rdTokens, setRDTokens] = useState<Tokens | null>(null);
	const [traktAuthed, setTraktAuthed] = useState(false);
	const [traktError, setTraktError] = useState<string | null>(null);

	const handleRDAuth = async () => {
		const r = await fetch("/api/auth/rd/start");

		if (!r.ok) {
			setRDError(await r.text());
			return;
		}

		const device = (await r.json()) as DeviceCode;

		setRDDevice(device);

		window.open(
			device.direct_verification_url ?? device.verification_url,
			"_blank"
		);
	};

	const router = useRouter();

	useEffect(() => {
		if (traktAuthed && rdTokens?.access_token) {
			router.push("/epg");
		}
	}, [rdTokens?.access_token, router, traktAuthed]);

	useEffect(() => {
		if (!rdDevice) {
			return;
		}

		const started = Date.now();

		const poll = async () => {
			const r = await fetch("/api/auth/rd/credentials", {
				body: JSON.stringify({ device_code: rdDevice.device_code }),
				headers: {
					"cache-control": "no-store",
					"content-type": "application/json"
				},
				method: "POST"
			});

			if (r.ok) {
				if (approvedRef.current) {
					return;
				}

				approvedRef.current = true;

				if (pollRef.current) {
					clearInterval(pollRef.current);
					pollRef.current = null;
				}

				setRDCredentials((await r.json()) as Credentials);

				return;
			}

			const expired = Date.now() - started > rdDevice.expires_in * 1000;

			if (expired) {
				if (pollRef.current) {
					clearInterval(pollRef.current);

					pollRef.current = null;
				}

				setRDError("Device code expired. Try again.");
			}
		};

		poll();

		pollRef.current = window.setInterval(poll, rdDevice.interval * 1000);

		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current);

				pollRef.current = null;
			}
		};
	}, [rdDevice]);

	useEffect(() => {
		if (exchangedRef.current || !rdCredentials || !rdDevice) {
			return;
		}

		exchangedRef.current = true;

		(async () => {
			const r = await fetch("/api/auth/rd/token", {
				body: JSON.stringify({
					client_id: rdCredentials.client_id,
					client_secret: rdCredentials.client_secret,
					device_code: rdDevice.device_code
				}),
				headers: { "content-type": "application/json" },
				method: "POST"
			});

			if (!r.ok) {
				setRDError(await r.text());

				exchangedRef.current = false;

				return;
			}

			const tokens = (await r.json()) as Tokens;

			setRDTokens(tokens);

			localStorage.setItem(
				"rd_auth",
				JSON.stringify({ credentials: rdCredentials, tokens: tokens })
			);
		})();
	}, [rdCredentials, rdDevice]);

	useEffect(() => {
		const checkTraktAuth = async () => {
			try {
				const response = await fetch("/api/auth/trakt/verify");

				if (response.ok) {
					setTraktAuthed(true);
				}
			} catch (error) {
				console.error("Failed to verify Trakt auth:", error);
			}
		};

		checkTraktAuth();

		const savedRDAuth = localStorage.getItem("rd_auth");

		if (savedRDAuth) {
			const { credentials, tokens } = JSON.parse(savedRDAuth);

			setRDCredentials(credentials);
			setRDTokens(tokens);
		}
	}, []);

	const handleTraktAuth = () => {
		const clientID = process.env.NEXT_PUBLIC_TRAKT_CLIENT_ID;
		const redirectURI = encodeURIComponent(
			process.env.NEXT_PUBLIC_TRAKT_REDIRECT_URI
		);
		const traktAuthURL = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectURI}`;

		window.location.href = traktAuthURL;
	};

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
							} font-bold text-slate-100 px-6 py-3 rounded tracking-wide ${
								rdTokens?.access_token
									? "bg-slate-700"
									: "bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 transition-colors"
							} w-4/5`}
							disabled={!!rdTokens?.access_token}
							onClick={handleRDAuth}
						>
							Real Debrid Authorized{" "}
							{!rdTokens?.access_token ? "❌" : "✅"}
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
