import { Redis } from "@upstash/redis";

type ProviderTokens = {
	access_token: string;
	refresh_token: string;
	expires_at: number;
};

type Session = {
	trakt?: ProviderTokens;
	rd?: ProviderTokens;
	pkce_verifier?: string;
	updated_at: number;
};

const redis = Redis.fromEnv();

const sessionStore = {
	del: async (sessionID: string) => {
		await redis.del(`session:${sessionID}`);
	},
	get: async (sessionID: string): Promise<Session | null> => {
		return (await redis.get<Session>(`session:${sessionID}`)) ?? null;
	},
	set: async (
		sessionID: string,
		data: Partial<Session>,
		ttl = 60 * 60 * 24 * 7
	) => {
		const currentSession = (await redis.get<Session>(
			`session:${sessionID}`
		)) ?? { updated_at: Date.now() };

		await redis.set(
			`session:${sessionID}`,
			{ ...currentSession, ...data, updated_at: Date.now() },
			{ ex: ttl }
		);
	}
};

export default sessionStore;
