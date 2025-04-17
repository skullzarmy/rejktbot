import fs from "fs";
import path from "path";
import { ScheduleConfig, ScheduleStore, FetchType } from "../types";

// Path to the schedule configuration file
const SCHEDULES_FILE_PATH = path.join(process.cwd(), "schedules.json");

/**
 * Utility for managing schedule configurations
 */
export class ScheduleManager {
    private schedules: ScheduleConfig[] = [];

    /**
     * Load schedules from the configuration file
     */
    async loadSchedules(): Promise<ScheduleConfig[]> {
        try {
            // Check if the file exists
            if (!fs.existsSync(SCHEDULES_FILE_PATH)) {
                // Create empty schedule store if file doesn't exist
                await this.saveSchedules([]);
            }

            // Read and parse the schedule file
            const data = fs.readFileSync(SCHEDULES_FILE_PATH, "utf8");
            const store: ScheduleStore = JSON.parse(data);
            this.schedules = store.schedules || [];

            return this.schedules;
        } catch (error) {
            console.error("Error loading schedules:", error);
            // Return empty schedules if there's an error
            this.schedules = [];
            return this.schedules;
        }
    }

    /**
     * Save schedules to the configuration file
     */
    async saveSchedules(schedules?: ScheduleConfig[]): Promise<void> {
        try {
            if (schedules) {
                this.schedules = schedules;
            }

            const store: ScheduleStore = {
                schedules: this.schedules,
                version: 1, // For future migrations if needed
            };

            fs.writeFileSync(SCHEDULES_FILE_PATH, JSON.stringify(store, null, 2));
            console.log("Schedules saved successfully");
        } catch (error) {
            console.error("Error saving schedules:", error);
        }
    }

    /**
     * Get a schedule by ID
     */
    getSchedule(id: string): ScheduleConfig | undefined {
        return this.schedules.find((schedule) => schedule.id === id);
    }

    /**
     * Get schedules for a specific Discord channel
     * @param channelId The Discord channel ID
     * @param guildId Optional Discord guild ID
     */
    getDiscordChannelSchedules(channelId: string, guildId?: string): ScheduleConfig[] {
        // Log for debugging channel association
        console.log(`Looking for schedules with channelId: ${channelId}, guildId: ${guildId || "any"}`);

        // Convert IDs to strings to ensure consistent comparison
        const channelIdStr = String(channelId);
        const guildIdStr = guildId ? String(guildId) : undefined;

        const matchingSchedules = this.schedules.filter((schedule) => {
            // Convert schedule channel IDs to strings for comparison
            const scheduleChannelId = schedule.discord?.channelId ? String(schedule.discord.channelId) : "";
            const scheduleGuildId = schedule.discord?.guildId ? String(schedule.discord.guildId) : undefined;

            const matches =
                scheduleChannelId === channelIdStr &&
                (!guildIdStr || scheduleGuildId === guildIdStr || !scheduleGuildId);

            // Log each schedule we examine for debugging
            if (schedule.discord) {
                console.log(
                    `Schedule ${schedule.id} - channel: ${scheduleChannelId}, guild: ${
                        scheduleGuildId || "none"
                    }, matches: ${matches}`
                );
            }

            return matches;
        });

        console.log(`Found ${matchingSchedules.length} matching schedules for channel ${channelId}`);
        return matchingSchedules;
    }

    /**
     * Get schedules for a specific Telegram chat
     * @param chatId The Telegram chat ID
     */
    getTelegramChatSchedules(chatId: string): ScheduleConfig[] {
        return this.schedules.filter((schedule) => schedule.telegram?.chatId === chatId);
    }

    /**
     * Add a new schedule
     * @param schedule The schedule to add
     */
    async addSchedule(schedule: ScheduleConfig): Promise<ScheduleConfig> {
        // Generate a unique ID if not provided
        if (!schedule.id) {
            schedule.id = Date.now().toString();
        }

        // Set creation time if not provided
        if (!schedule.createdAt) {
            schedule.createdAt = Date.now();
        }

        this.schedules.push(schedule);
        await this.saveSchedules();
        return schedule;
    }

    /**
     * Update an existing schedule
     */
    async updateSchedule(updatedSchedule: ScheduleConfig): Promise<ScheduleConfig | null> {
        const index = this.schedules.findIndex((s) => s.id === updatedSchedule.id);

        if (index === -1) {
            return null;
        }

        // Keep the original creation info
        updatedSchedule.createdAt = this.schedules[index].createdAt;
        updatedSchedule.createdBy = this.schedules[index].createdBy;

        this.schedules[index] = updatedSchedule;
        await this.saveSchedules();
        return updatedSchedule;
    }

    /**
     * Delete a schedule by ID
     */
    async deleteSchedule(id: string): Promise<boolean> {
        const initialLength = this.schedules.length;
        this.schedules = this.schedules.filter((s) => s.id !== id);

        if (this.schedules.length !== initialLength) {
            await this.saveSchedules();
            return true;
        }

        return false;
    }

    /**
     * Check if a user can manage a schedule
     * @param scheduleId The ID of the schedule
     * @param platform The platform (discord or telegram)
     * @param userId The user ID
     * @param isAdmin Whether the user has admin privileges
     */
    canUserManageSchedule(
        scheduleId: string,
        platform: "discord" | "telegram",
        userId: string,
        isAdmin = false
    ): boolean {
        const schedule = this.getSchedule(scheduleId);

        if (!schedule) {
            return false;
        }

        // Admins can manage any schedule
        if (isAdmin) {
            return true;
        }

        // Check if the user created this schedule
        return schedule.createdBy?.platform === platform && schedule.createdBy?.userId === userId;
    }

    /**
     * Get all schedules
     */
    getAllSchedules(): ScheduleConfig[] {
        return [...this.schedules];
    }

    /**
     * Get enabled schedules
     */
    getEnabledSchedules(): ScheduleConfig[] {
        return this.schedules.filter((s) => s.enabled);
    }

    /**
     * Create a new user schedule
     */
    async createUserSchedule({
        name,
        fetchType,
        cronExpression,
        platform,
        channelId,
        guildId,
        chatId,
        userId,
        username,
    }: {
        name: string;
        fetchType: FetchType;
        cronExpression: string;
        platform: "discord" | "telegram";
        channelId?: string;
        guildId?: string;
        chatId?: string;
        userId: string;
        username?: string;
    }): Promise<ScheduleConfig> {
        const newSchedule: ScheduleConfig = {
            id: `${platform}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name,
            cronExpression,
            enabled: true,
            fetchType,
            createdAt: Date.now(),
            createdBy: {
                platform,
                userId,
                username,
            },
        };

        // Add platform-specific fields
        if (platform === "discord" && channelId) {
            newSchedule.discord = {
                channelId,
                guildId,
            };
        } else if (platform === "telegram" && chatId) {
            newSchedule.telegram = {
                chatId,
            };
        }

        return await this.addSchedule(newSchedule);
    }
}
