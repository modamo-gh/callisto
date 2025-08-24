import { Dispatch, SetStateAction } from "react";

export type Channel = {
	name: string;
	programs: (Episode | Program | Show)[];
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

export type EPGClientProps = {
	channels: Channels;
};

export type EPGContextType = {
	channels: Channels;
	currentChannelIndex: number;
	currentRDLink: string | null;
	episodeMetaCache: Map<number, EpisodeMeta>;
	episodeTMDBCache: Map<number, any>;
	ensureProgramMeta: (program: Episode | Program | Show) => Promise<void>;
	fetchEpisodeTMDB: (show: Show) => Promise<any>;
	fetchEpisodeMeta: (index: number, episode: Episode) => Promise<EpisodeMeta>;
	fetchMovieMeta: (index: number, program: Program) => Promise<ProgramMeta>;
	fetchMovieTMDB: (index: number, program: Program) => Promise<any>;
	getProgramMeta: (
		program: Episode | Program | Show
	) => EpisodeMeta | ProgramMeta | null;
	fetchShowTMDB: (index: number, show: Show) => Promise<any>;
	movieMetaCache: Map<number, ProgramMeta>;
	runtimeTracker: Map<string, number>;
	streamingLinks: Map<string, any>;
	setCurrentChannelIndex: Dispatch<SetStateAction<number>>;
	setCurrentRDLink: Dispatch<SetStateAction<string | null>>;
	setRuntimeTracker: Dispatch<SetStateAction<Map<string, number>>>;
	showMetaCache: Map<number, ProgramMeta>;
};

export type Episode = Program & {
	episodeTitle: string;
	episodeTMDB: number;
	number: number;
	season: number;
};

export type EpisodeMeta = ProgramMeta & {
	episodeNumber?: number;
	episodeTitle?: string;
	season?: number;
};

export type Program = {
	id: string;
	kind: ProgramKind;
	title: string;
	tmdb: number;
};

export type ProgramKind = "episode" | "movie" | "tv";

export type ProgramMeta = {
	genres?: string[];
	overview: string;
	releaseDate: string;
	runtime: number;
};

export type Show = Program & { episodeTMDB: null | number };

export type Tokens = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
};
