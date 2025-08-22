"use client";

import { Orbitron } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const orbitron = Orbitron({
	subsets: ["latin"],
	weight: ["400", "700", "900"]
});

type Credentials = {
	client_id: string;
	client_secret: string;
};

type DeviceCode = {
	device_code: string;
	user_code: string;
	interval: number;
	expires_in: number;
	verification_url: string;
	direct_verification_url: string;
};

type Tokens = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
};

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

			const tokens = (await r.json()) as Tokens

			setRDTokens(tokens);
			localStorage.setItem("rd_tokens", JSON.stringify(tokens));
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

		const savedRDTokens = localStorage.getItem("rd_tokens");

		if (savedRDTokens) {
			setRDTokens(JSON.parse(savedRDTokens));
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
		<div className="bg-slate-800 flex flex-col gap-6 h-screen items-center justify-center relative w-screen">
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
			<div className="flex flex-col items-center gap-4">
				<div className="flex gap-2 items-center">
					<button
						className={`${
							orbitron.className
						} font-bold text-slate-100 px-6 py-3 rounded tracking-wide ${
							traktAuthed
								? "bg-slate-700"
								: "bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 transition-colors"
						}`}
						disabled={traktAuthed}
						onClick={handleTraktAuth}
					>
						Authorize Trakt
					</button>
					<p className="text-4xl">{!traktAuthed ? "⌛" : "✅"}</p>
				</div>
				<div className="flex gap-2 items-center">
					<button
						className={`${
							orbitron.className
						} font-bold text-slate-100 px-6 py-3 rounded tracking-wide ${
							rdTokens?.access_token
								? "bg-slate-700"
								: "bg-cyan-500 hover:bg-cyan-400 hover:cursor-pointer duration-200 transition-colors"
						}`}
						disabled={!!rdTokens?.access_token}
						onClick={handleRDAuth}
					>
						Authorize Real Debrid
					</button>
					<p className="text-4xl">
						{!rdTokens?.access_token ? "⌛" : "✅"}
					</p>
				</div>
			</div>
		</div>
	);
};

export default Home;
