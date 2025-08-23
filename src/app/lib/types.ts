import { Dispatch, SetStateAction } from "react";

export type BasicContent = {
	id: string;
	title: string;
	tmdbID: number;
	type: "movie" | "tv";
};

export type Channel = {
	name: string;
	programs: Program[];
};

export type Channels = Channel[];

export type Credentials = {
	client_id: string;
	client_secret: string;
};

export type DeviceCode = {
	device_code: string;
	user_code: string;
	interval: number;
	expires_in: number;
	verification_url: string;
	direct_verification_url: string;
};

export interface EnrichedContent extends BasicContent {
	episodeName?: string;
	episodeNumber?: number;
	episodeTMDBID?: number;
	genres?: string[];
	overview?: string;
	releaseDate?: string;
	runtime?: number;
	seasonNumber?: number;
}

export type EPGClientProps = {
	channels: Channels;
};

export type EPGContextType = {
	channels: Channels;
	currentChannelIndex: number;
	currentRDLink: string | null;
	getProgramMeta: (index: number, program: Program) => Promise<void>;
	runtimeTracker: Map<string, number>;
	streamingLinks: Map<string, any>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	setCurrentRDLink: Dispatch<SetStateAction<string | null>>;
	setRuntimeTracker: Dispatch<SetStateAction<Map<string, number>>>;
	tmdbCache: Map<number, EpisodeMeta | ProgramMeta>;
};

export type Episode = Program & {};

export type EpisodeMeta = ProgramMeta & {
	episodeNumber: number;
	name: string;
	seasonNumber: string;
};

export type Movie = Program & {};

export type Program = {
	id: string;
	kind: "movie" | "tv";
	title: string;
	tmdb: number;
};

export type ProgramMeta = {
	genres: string[];
	overview: string;
	releaseDate: string;
	runtime: number;
};

export type Tokens = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
};
