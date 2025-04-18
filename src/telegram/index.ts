import { Telegraf } from "telegraf";
import { TELEGRAM_BOT_TOKEN } from "../config";
import { MessageSender, SchedulerService } from "../services/scheduler";
import { FetchType } from "../types";
import { ApiService } from "../services/api";
import { registerScheduleCommands } from "./commands/schedule";

export class TelegramBot implements MessageSender {
    private bot: Telegraf;
    private apiService: ApiService;
    private schedulerService?: SchedulerService;

    constructor(apiService: ApiService) {
        this.apiService = apiService;
        this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);
        // Set up commands immediately using the simpler approach from the example
        this.setupCommands();
    }

    /**
     * Set the scheduler service for command handling
     */
    setSchedulerService(schedulerService: SchedulerService) {
        this.schedulerService = schedulerService;

        // Register schedule commands only after we have the scheduler service
        if (this.bot) {
            registerScheduleCommands(this.bot, schedulerService);
        }
    }

    /**
     * Set up the bot's commands - using the simpler approach from the example
     */
    private setupCommands() {
        // Start command
        this.bot.start((ctx) => ctx.reply("Welcome to REJKTbot!"));

        // Command to get a random artist
        this.bot.command("random_artist", (ctx) => this.handleRandomCommand(ctx, "artist"));

        // Command to get a random NFT
        this.bot.command("random_nft", (ctx) => this.handleRandomCommand(ctx, "nft"));

        // Help command
        this.bot.help((ctx) =>
            ctx.reply(
                "Available commands:\n" +
                    "/random_artist - Get a random artist\n" +
                    "/random_nft - Get a random NFT\n" +
                    "/schedule_create [artist|nft] [cron] [name] - Create a new scheduled post\n" +
                    "/schedule_list - List all schedules for this chat\n" +
                    "/schedule_delete [id] - Delete a schedule by ID\n" +
                    "/schedule_pause [id] - Pause a schedule\n" +
                    "/schedule_resume [id] - Resume a paused schedule\n" +
                    "/help - Show this help message"
            )
        );

        // Simple error handling
        this.bot.catch((err) => {
            console.error("Telegram error:", err);
        });
    }

    /**
     * Handle the random command (artist or NFT)
     */
    private async handleRandomCommand(ctx: any, type: FetchType) {
        try {
            // Show typing indicator
            await ctx.replyWithChatAction("typing");

            let data;

            if (type === "artist") {
                data = await this.apiService.getRandomArtist();
                if (data) {
                    // Format artist information with proper Markdown for Telegram
                    const caption = this.formatArtistCaption(data);

                    if (data.imageUrl) {
                        // Send image with caption if available
                        await ctx.replyWithPhoto(
                            { url: data.imageUrl },
                            {
                                caption: caption,
                                parse_mode: "HTML",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: "View on REJKT",
                                                url: data.profileLink || "https://rejkt.xyz",
                                            },
                                        ],
                                    ],
                                },
                            }
                        );
                    } else {
                        // Send text only if no image
                        await ctx.reply(caption, {
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "View on REJKT",
                                            url: data.profileLink || "https://rejkt.xyz",
                                        },
                                    ],
                                ],
                            },
                        });
                    }
                }
            } else {
                data = await this.apiService.getRandomNFT();
                if (data) {
                    // Format NFT information with proper Markdown for Telegram
                    const caption = this.formatNFTCaption(data);

                    if (data.imageUrl) {
                        // Send image with caption if available
                        await ctx.replyWithPhoto(
                            { url: data.imageUrl },
                            {
                                caption: caption,
                                parse_mode: "HTML",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: "View on Objkt",
                                                url: data.referralLink || "https://objkt.com",
                                            },
                                        ],
                                    ],
                                },
                            }
                        );
                    } else {
                        // Send text only if no image
                        await ctx.reply(caption, {
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "View on Objkt",
                                            url: data.referralLink || "https://objkt.com",
                                        },
                                    ],
                                ],
                            },
                        });
                    }
                }
            }

            if (!data) {
                await ctx.reply(`Failed to fetch ${type} data. Please try again later.`);
                return;
            }
        } catch (error) {
            console.error(`Error handling random ${type} command:`, error);
            await ctx.reply(`There was an error fetching the ${type}. Please try again later.`);
        }
    }

    /**
     * Format artist information with HTML for Telegram
     */
    private formatArtistCaption(data: any): string {
        let caption = `<b>🎨 ${this.escapeHTML(data.name)}</b>\n\n`;

        // Add wallet address
        caption += `<b>Wallet:</b> ${this.escapeHTML(data.address)}\n\n`;

        // Add links section if any social media or websites are available
        if (data.website || data.twitter || data.tzdomain || data.telegram) {
            caption += `<b>Links:</b>\n`;

            if (data.website) {
                caption += `• Website: ${this.escapeHTML(data.website)}\n`;
            }

            if (data.twitter) {
                caption += `• Twitter: ${this.escapeHTML(data.twitter)}\n`;
            }

            if (data.tzdomain) {
                caption += `• TZ Domain: ${this.escapeHTML(data.tzdomain)}\n`;
            }

            if (data.telegram) {
                caption += `• Telegram: ${this.escapeHTML(data.telegram)}\n`;
            }

            caption += "\n";
        }

        // Use bio as fallback if available
        if (data.bio) {
            // Limit bio to reasonable length for Telegram
            const bioText = data.bio.length > 500 ? data.bio.substring(0, 500) + "..." : data.bio;
            caption += `<b>Recent Work:</b>\n${this.escapeHTML(bioText)}\n\n`;
        }

        caption += `<i>REJKT Bot • Artist Showcase • ${new Date().toLocaleDateString()}</i>`;

        return caption;
    }

    /**
     * Format NFT information with HTML for Telegram
     */
    private formatNFTCaption(data: any): string {
        let caption = `<b>🖼️ ${this.escapeHTML(data.name)}</b>\n\n`;

        if (data.description) {
            // Limit description to reasonable length for Telegram
            const descText =
                data.description.length > 800 ? data.description.substring(0, 800) + "..." : data.description;
            caption += `${this.escapeHTML(descText)}\n\n`;
        }

        if (data.price) {
            caption += `<b>Price:</b> ${this.escapeHTML(data.price)}\n\n`;
        }

        caption += `<i>REJKT Bot • NFT Showcase • ${new Date().toLocaleDateString()}</i>`;

        return caption;
    }

    /**
     * Escape HTML special characters to prevent injection
     */
    private escapeHTML(text: string): string {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /**
     * Start the Telegram bot - Using the simple approach exactly like the example
     */
    async start() {
        try {
            // Quick validation of token
            if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.length < 10) {
                throw new Error("Invalid Telegram bot token format");
            }

            console.log("Starting Telegram bot...");

            // Launch with the simplest possible approach - exactly like the example
            this.bot.launch();

            console.log("Telegram bot launched successfully");

            // Enable graceful stop
            process.once("SIGINT", () => this.bot.stop("SIGINT"));
            process.once("SIGTERM", () => this.bot.stop("SIGTERM"));

            return Promise.resolve(); // Return a resolved promise for async compatibility
        } catch (error) {
            console.error("Error starting Telegram bot:", error instanceof Error ? error.message : String(error));
            return Promise.reject(error);
        }
    }

    /**
     * Stop the Telegram bot
     */
    async stop() {
        this.bot.stop();
        console.log("Telegram bot stopped");
    }

    /**
     * Implement the MessageSender interface to send a message to a Telegram chat
     */
    async sendMessage(content: string, chatId?: string): Promise<void> {
        try {
            if (!chatId || chatId === "your_telegram_chat_id_here") {
                console.log("No valid Telegram chat ID provided for scheduled message, skipping...");
                return;
            }
            await this.bot.telegram.sendMessage(chatId, content);
        } catch (error) {
            console.error("Error sending message to Telegram:", error);
        }
    }
}
