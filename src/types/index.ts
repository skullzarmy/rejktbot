// Define common types used across the application

export interface ApiResponse {
    success: boolean;
    data: any;
    error?: string;
}

// Artist API response types
export interface ListingSold {
    amount: number;
    price_xtz: number;
    price: number;
    timestamp: string;
}

export interface Creator {
    creator_address: string;
}

export interface FA {
    collection_id: string | null;
    collection_type: string;
    description: string;
    name: string;
    creator: string | null | FACreator;
}

export interface FACreator {
    address: string;
    inserted_at: string;
    alias: string;
    website: string | null;
    tzdomain: string | null;
    twitter: string | null;
    telegram: string | null;
    logo: string | null;
    flag: string;
    flag_reason: string | null;
    farcaster?: string | null;
    listings_sold: ListingSold[];
}

export interface Token {
    token_id: string;
    fa_contract: string;
    pk: number;
    name: string;
    timestamp: string;
    display_uri: string;
    description: string;
    mime: string;
    artifact_uri: string;
    supply: number;
    creators: Creator[];
    fa: FA;
}

export interface Artist {
    address: string;
    inserted_at: string;
    alias: string;
    website: string | null;
    tzdomain: string | null;
    twitter: string | null;
    telegram: string | null;
    logo: string | null;
    flag: string;
    flag_reason: string | null;
    listings_sold: ListingSold[];
}

export interface Listing {
    id: number;
    price: number;
    price_xtz: number;
    seller_address: string;
    amount: number;
    amount_left: number;
    token: Token;
    seller: Artist;
}

export interface ArtistResponse {
    artist: Artist;
    sampleListing: Listing;
    timestamp: string;
    profileLink: string; // Link to view artist on REJKT
}

export interface ListingResponse {
    listing: Listing;
    timestamp: string;
    referralLink: string; // Link to view listing on Objkt
}

// For backwards compatibility with our service interfaces
export interface ArtistData {
    id: string;
    name: string;
    address: string;
    bio?: string;
    imageUrl?: string;
    profileLink?: string; // Link to view artist on REJKT
    token?: Token;
    sampleListing?: Listing;
}

export interface NFTListing {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    referralLink?: string; // Link to view listing on Objkt
    token?: Token;
    seller?: Artist;
}

export type FetchType = "artist" | "nft";

export interface ScheduleConfig {
    id: string;
    name: string;
    cronExpression: string;
    enabled: boolean;
    fetchType: FetchType;
    createdAt: number;
    createdBy?: {
        platform: "discord" | "telegram";
        userId: string;
        username?: string;
    };
    discord?: {
        channelId: string;
        guildId?: string;
    };
    telegram?: {
        chatId: string;
    };
}

export interface ScheduleStore {
    schedules: ScheduleConfig[];
    version: number;
}
