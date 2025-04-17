import {
    Client,
    Events,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    TextChannel,
    ChannelType,
} from "discord.js";
import { DISCORD_TOKEN, DISCORD_CLIENT_ID } from "../config";
import { MessageSender, SchedulerService } from "../services/scheduler";
import { FetchType } from "../types";
import { ApiService } from "../services/api";

export class DiscordBot implements MessageSender {
    private client: Client;
    private apiService: ApiService;
    private schedulerService?: SchedulerService;
    private ready = false;
    private commands: any[] = [];

    constructor(apiService: ApiService) {
        this.apiService = apiService;
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds],
        });

        this.setupCommands();
        this.setupEvents();
    }

    /**
     * Set the scheduler service for command handling
     */
    setSchedulerService(schedulerService: SchedulerService) {
        this.schedulerService = schedulerService;
    }

    /**
     * Set up the bot's slash commands
     */
    private setupCommands() {
        // Command to get a random artist
        const randomArtistCommand = new SlashCommandBuilder()
            .setName("random-artist")
            .setDescription("Get a random artist");

        // Command to get a random NFT
        const randomNFTCommand = new SlashCommandBuilder().setName("random-nft").setDescription("Get a random NFT");

        // Import slash commands directly using import instead of require
        // This fixes issues with ES modules vs CommonJS modules
        this.commands = [randomArtistCommand.toJSON(), randomNFTCommand.toJSON()];

        try {
            // Import the schedule command directly from the file path
            const scheduleFile = require("./commands/schedule");

            // Debug what we're actually getting from the file
            if (scheduleFile) {
                console.log("Schedule command module loaded, checking for data property");

                if (scheduleFile.data) {
                    const scheduleData = scheduleFile.data;

                    // Add the schedule command to our commands list
                    if (typeof scheduleData.toJSON === "function") {
                        const commandJson = scheduleData.toJSON();
                        this.commands.push(commandJson);
                        console.log("Schedule command registered successfully");
                    } else {
                        // If it's already in JSON format, ensure it has the required properties
                        this.commands.push(scheduleData);
                        console.log("Schedule command registered (already in JSON format)");
                    }

                    // Debug log to see what's being registered
                    console.log("Command structure:", JSON.stringify(this.commands[this.commands.length - 1], null, 2));
                } else {
                    console.error("Schedule command module loaded but missing 'data' property");
                }
            } else {
                console.error("Failed to load schedule command module");
            }
        } catch (error) {
            console.error("Error setting up schedule command:", error);
        }
    }

    /**
     * Set up the bot's event handlers
     */
    private setupEvents() {
        // Ready event
        this.client.once(Events.ClientReady, (client) => {
            console.log(`Discord bot logged in as ${client.user.tag}`);
            this.ready = true;
        });

        // Interaction event (for slash commands)
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;

            try {
                const { commandName } = interaction;

                if (commandName === "random-artist") {
                    await this.handleRandomCommand(interaction, "artist");
                } else if (commandName === "random-nft") {
                    await this.handleRandomCommand(interaction, "nft");
                } else if (commandName === "schedule") {
                    // Import the schedule command handler dynamically
                    const { execute } = require("./commands/schedule");

                    if (this.schedulerService) {
                        await execute(interaction, this.schedulerService);
                    } else {
                        await interaction.reply({
                            content: "Scheduler service not available. Please try again later.",
                            ephemeral: true,
                        });
                    }
                }
            } catch (error) {
                console.error("Error handling Discord command:", error);

                try {
                    await interaction.reply({
                        content: "There was an error executing this command.",
                        ephemeral: true,
                    });
                } catch (replyError) {
                    // The interaction might have already been replied to or timed out
                    console.error("Error replying to interaction:", replyError);
                }
            }
        });
    }

    /**
     * Handle the random command (artist or NFT)
     */
    private async handleRandomCommand(interaction: any, type: FetchType) {
        await interaction.deferReply();

        try {
            let data;

            if (type === "artist") {
                data = await this.apiService.getRandomArtist();
                if (data) {
                    // Create a rich embed for the artist
                    const embed = {
                        color: 0x6441a4, // Purple color for artist embeds
                        title: `🎨 ${data.name}`,
                        description: data.bio ? data.bio.substring(0, 2000) : undefined,
                        thumbnail: {
                            url: "https://rejkt.xyz/logo.png", // Optional: Add your service logo as a thumbnail
                        },
                        image: data.imageUrl
                            ? {
                                  url: data.imageUrl,
                              }
                            : null,
                        fields: [],
                        footer: {
                            text: "REJKT Bot • Artist Showcase",
                        },
                        timestamp: new Date(),
                    };

                    // Create action button using component
                    const row = {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 5, // Link button
                                label: "View on REJKT",
                                url: data.profileLink || "https://rejkt.xyz",
                            },
                        ],
                    };

                    await interaction.editReply({ embeds: [embed], components: data.profileLink ? [row] : [] });
                }
            } else {
                data = await this.apiService.getRandomNFT();
                if (data) {
                    // Create a rich embed for the NFT
                    const embed = {
                        color: 0xff5733, // Orange color for NFT embeds
                        title: `🖼️ ${data.name}`,
                        description: data.description ? data.description.substring(0, 2000) : undefined,
                        thumbnail: {
                            url: "https://objkt.com/favicon.ico", // Optional: Add Objkt logo as a thumbnail
                        },
                        image: data.imageUrl
                            ? {
                                  url: data.imageUrl,
                              }
                            : null,
                        fields: data.price
                            ? [
                                  {
                                      name: "Price",
                                      value: data.price,
                                      inline: true,
                                  },
                              ]
                            : [],
                        footer: {
                            text: "REJKT Bot • NFT Showcase",
                        },
                        timestamp: new Date(),
                    };

                    // Add seller information if available
                    if (data.seller && data.seller.alias) {
                        embed.fields.push({
                            name: "Creator",
                            value: data.seller.alias,
                            inline: true,
                        });
                    }

                    // Create action button using component
                    const row = {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 5, // Link button
                                label: "View on Objkt",
                                url: data.referralLink || "https://objkt.com",
                            },
                        ],
                    };

                    await interaction.editReply({ embeds: [embed], components: data.referralLink ? [row] : [] });
                }
            }

            if (!data) {
                await interaction.editReply(`Failed to fetch ${type} data. Please try again later.`);
                return;
            }
        } catch (error) {
            console.error(`Error handling random ${type} command:`, error);
            await interaction.editReply(`There was an error fetching the ${type}. Please try again later.`);
        }
    }

    /**
     * Register the bot's slash commands
     */
    async registerCommands() {
        try {
            console.log("Started refreshing Discord slash commands...");

            const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

            // Print out all commands being registered
            console.log(
                `Registering ${this.commands.length} commands: ${this.commands.map((cmd) => cmd.name).join(", ")}`
            );

            // Force a complete refresh of all commands
            await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: this.commands });

            console.log("Successfully registered Discord slash commands");
        } catch (error) {
            console.error("Error registering Discord slash commands:", error);
        }
    }

    /**
     * Start the Discord bot
     */
    async start() {
        try {
            await this.client.login(DISCORD_TOKEN);
            await this.registerCommands();
        } catch (error) {
            console.error("Error starting Discord bot:", error);
            throw error;
        }
    }

    /**
     * Stop the Discord bot
     */
    async stop() {
        this.client.destroy();
        console.log("Discord bot stopped");
    }

    /**
     * Implement the MessageSender interface to send a message to a Discord channel
     */
    async sendMessage(content: string, channelId: string): Promise<void> {
        if (!this.ready) {
            console.error("Discord bot not ready");
            return;
        }

        try {
            const channel = await this.client.channels.fetch(channelId);

            // Check if channel exists and is a text-based channel
            if (!channel) {
                console.error(`Channel not found: ${channelId}`);
                return;
            }

            if (
                channel.type !== ChannelType.GuildText &&
                channel.type !== ChannelType.DM &&
                channel.type !== ChannelType.GuildAnnouncement
            ) {
                console.error(`Channel ${channelId} is not a text channel`);
                return;
            }

            // Now TypeScript knows this is a text-based channel that can send messages
            await (channel as TextChannel).send({ content });
        } catch (error) {
            console.error("Error sending message to Discord:", error);
        }
    }
}
