import { ARTIST_ENDPOINT, NFT_ENDPOINT, API_KEY } from "../config";
import {
    ApiResponse,
    ArtistData,
    NFTListing,
    FetchType,
    ArtistResponse,
    ListingResponse,
    Artist,
    Listing,
} from "../types";

/**
 * Service to handle API calls to fetch artists and NFT listings
 */
export class ApiService {
    // API Endpoints are now imported from config
    private readonly ARTIST_ENDPOINT = ARTIST_ENDPOINT;
    private readonly NFT_ENDPOINT = NFT_ENDPOINT;

    /**
     * Format price from microtez to tez
     * @param microtez Price in microtez (millionths of a tez)
     * @returns Formatted price string in tez
     */
    private formatPrice(microtez: number): string {
        const tez = microtez / 1000000;
        return `${tez} ꜩ`;
    }

    /**
     * Convert IPFS URI to HTTP URL
     * @param uri IPFS URI (ipfs://...)
     * @returns HTTP URL for the IPFS content
     */
    private ipfsToHttp(uri: string | null): string | undefined {
        if (!uri) return undefined;

        if (uri.startsWith("ipfs://")) {
            return `https://ipfs.io/ipfs/${uri.slice(7)}`;
        }

        return uri;
    }

    /**
     * Fetch data from the API
     * @param type The type of data to fetch ('artist' or 'nft')
     * @returns Promise with the API response
     */
    async fetchData(type: FetchType): Promise<ApiResponse> {
        try {
            const endpoint = type === "artist" ? this.ARTIST_ENDPOINT : this.NFT_ENDPOINT;

            const response = await fetch(endpoint, {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Get a random artist
     * @returns Promise with artist data
     */
    async getRandomArtist(): Promise<ArtistData | null> {
        const response = await this.fetchData("artist");

        if (response.success && response.data) {
            const artistResponse = response.data as ArtistResponse;
            const artist = artistResponse.artist;
            const sampleListing = artistResponse.sampleListing;

            // Create a formatted ArtistData object from the response, prioritizing artist details
            const artistData: ArtistData = {
                id: artist.address,
                name: artist.alias || "Unknown Artist",
                address: artist.address,
                bio: undefined, // We'll add artist description when API provides it
                imageUrl: artist.logo ? this.ipfsToHttp(artist.logo) : this.ipfsToHttp(sampleListing.token.display_uri),
                profileLink: artistResponse.profileLink,
                website: artist.website || undefined,
                twitter: artist.twitter || undefined,
                tzdomain: artist.tzdomain || undefined,
                telegram: artist.telegram || undefined,
                token: sampleListing.token,
                sampleListing: sampleListing,
            };

            return artistData;
        }

        return null;
    }

    /**
     * Get a random NFT listing
     * @returns Promise with NFT listing data
     */
    async getRandomNFT(): Promise<NFTListing | null> {
        // Use the dedicated NFT listing endpoint
        const response = await this.fetchData("nft");

        if (response.success && response.data) {
            const listingResponse = response.data as ListingResponse;
            const listing = listingResponse.listing;
            const token = listing.token;
            const seller = listing.seller;

            // Create a formatted NFTListing object from the response
            const nftListing: NFTListing = {
                id: token.token_id,
                name: token.name,
                description: token.description,
                imageUrl: this.ipfsToHttp(token.display_uri),
                price: this.formatPrice(listing.price_xtz),
                referralLink: listingResponse.referralLink, // Add the referral link from the response
                token: token,
                seller: seller,
            };

            return nftListing;
        }

        return null;
    }
}
