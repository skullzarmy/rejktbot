import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Discord configuration
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN as string;
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID as string;
export const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID as string;

// Telegram configuration
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID as string;

// API configuration
export const ARTIST_ENDPOINT = process.env.ARTIST_ENDPOINT || "https://beta.rejkt.xyz/.netlify/functions/randomArtist";
export const NFT_ENDPOINT = process.env.NFT_ENDPOINT || "https://beta.rejkt.xyz/.netlify/functions/randomListing";
export const API_KEY = process.env.API_KEY as string;

// Schedule configuration
export const SCHEDULE_CRON = process.env.SCHEDULE_CRON || "0 */6 * * *"; // Default: every 6 hours

// Validate required environment variables
export const validateConfig = (): boolean => {
    const missingVars: string[] = [];

    // Check Discord variables if using Discord
    if (!DISCORD_TOKEN) missingVars.push("DISCORD_TOKEN");
    if (!DISCORD_CLIENT_ID) missingVars.push("DISCORD_CLIENT_ID");

    // Check Telegram variables if using Telegram
    if (!TELEGRAM_BOT_TOKEN) missingVars.push("TELEGRAM_BOT_TOKEN");

    // Check API endpoints
    // We don't check these since they have default values
    // But we log a warning if they're missing from the environment
    if (!process.env.ARTIST_ENDPOINT) {
        console.warn("ARTIST_ENDPOINT not set in environment, using default");
    }
    if (!process.env.NFT_ENDPOINT) {
        console.warn("NFT_ENDPOINT not set in environment, using default");
    }

    if (missingVars.length > 0) {
        console.error("Missing required environment variables:", missingVars.join(", "));
        return false;
    }

    return true;
};
