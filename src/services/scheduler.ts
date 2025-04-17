import * as cron from "node-cron";
import { ApiService } from "./api";
import { FetchType, ScheduleConfig } from "../types";

// We'll implement these interfaces in the appropriate platform modules
export interface MessageSender {
    sendMessage(content: string, chatId: string): Promise<void>;
}

/**
 * Service to handle scheduled tasks
 */
export class SchedulerService {
    private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
    private apiService: ApiService;
    private discordSender?: MessageSender;
    private telegramSender?: MessageSender;

    constructor(apiService: ApiService) {
        this.apiService = apiService;
    }

    /**
     * Set the Discord message sender
     */
    setDiscordSender(sender: MessageSender) {
        this.discordSender = sender;
    }

    /**
     * Set the Telegram message sender
     */
    setTelegramSender(sender: MessageSender) {
        this.telegramSender = sender;
    }

    /**
     * Add scheduled tasks from configurations
     * @param schedules Array of schedule configurations
     */
    addScheduledTasks(schedules: ScheduleConfig[]) {
        // Only add enabled schedules
        const enabledSchedules = schedules.filter((schedule) => schedule.enabled);

        for (const schedule of enabledSchedules) {
            this.addSchedule(schedule);
        }

        console.log(`Added ${enabledSchedules.length} scheduled tasks`);
    }

    /**
     * Add a new scheduled task from configuration
     * @param schedule The schedule configuration
     */
    addSchedule(schedule: ScheduleConfig) {
        // Skip if we already have this scheduled task
        if (this.scheduledTasks.has(schedule.id)) {
            return;
        }

        if (!this.discordSender && !this.telegramSender) {
            console.error("No message senders configured");
            return;
        }

        // Skip if no Discord or Telegram targets are configured
        if (
            (!schedule.discord?.channelId || schedule.discord.channelId === "") &&
            (!schedule.telegram?.chatId || schedule.telegram.chatId === "")
        ) {
            console.warn(`Schedule "${schedule.name}" has no valid targets configured. Skipping.`);
            return;
        }

        try {
            const task = cron.schedule(schedule.cronExpression, async () => {
                try {
                    let data;
                    let message = "";

                    // Fetch data based on type
                    if (schedule.fetchType === "artist") {
                        data = await this.apiService.getRandomArtist();
                        if (data) {
                            message = `🎨 Random Artist: ${data.name}\n`;
                            if (data.bio) message += `Bio: ${data.bio.substring(0, 200)}...\n`;
                            if (data.imageUrl) message += `Image: ${data.imageUrl}\n`;
                            // Add the profileLink as CTA
                            if (data.profileLink) message += `\nView on REJKT: ${data.profileLink}`;
                        }
                    } else {
                        data = await this.apiService.getRandomNFT();
                        if (data) {
                            message = `🖼️ Random NFT: ${data.name}\n`;
                            if (data.description) message += `Description: ${data.description.substring(0, 200)}...\n`;
                            if (data.price) message += `Price: ${data.price}\n`;
                            if (data.imageUrl) message += `Image: ${data.imageUrl}\n`;
                            // Add the referralLink as main CTA
                            if (data.referralLink) message += `\nView on Objkt: ${data.referralLink}`;
                        }
                    }

                    if (!data) {
                        console.error(`Failed to fetch ${schedule.fetchType} data for schedule "${schedule.name}"`);
                        return;
                    }

                    // Send to Discord if channel ID is provided
                    if (schedule.discord?.channelId && this.discordSender) {
                        await this.discordSender.sendMessage(message, schedule.discord.channelId);
                        console.log(`Sent ${schedule.fetchType} to Discord channel ${schedule.discord.channelId}`);
                    }

                    // Send to Telegram if chat ID is provided
                    if (schedule.telegram?.chatId && this.telegramSender) {
                        await this.telegramSender.sendMessage(message, schedule.telegram.chatId);
                        console.log(`Sent ${schedule.fetchType} to Telegram chat ${schedule.telegram.chatId}`);
                    }
                } catch (error) {
                    console.error(`Error in scheduled task "${schedule.name}":`, error);
                }
            });

            this.scheduledTasks.set(schedule.id, task);
            console.log(
                `Scheduled task "${schedule.name}" (${schedule.fetchType}) with cron: ${schedule.cronExpression}`
            );
        } catch (error) {
            console.error(`Error creating schedule "${schedule.name}":`, error);
        }
    }

    /**
     * Update an existing scheduled task
     * @param schedule Updated schedule configuration
     */
    updateSchedule(schedule: ScheduleConfig) {
        // Stop the existing task if it exists
        this.removeSchedule(schedule.id);

        // Only add the schedule if it's enabled
        if (schedule.enabled) {
            this.addSchedule(schedule);
        }
    }

    /**
     * Remove a scheduled task by ID
     * @param scheduleId The ID of the schedule to remove
     */
    removeSchedule(scheduleId: string) {
        const task = this.scheduledTasks.get(scheduleId);
        if (task) {
            task.stop();
            this.scheduledTasks.delete(scheduleId);
            console.log(`Removed scheduled task ${scheduleId}`);
            return true;
        }
        return false;
    }

    /**
     * Stop all scheduled tasks
     */
    stopAllTasks() {
        for (const [id, task] of this.scheduledTasks.entries()) {
            task.stop();
            console.log(`Stopped task ${id}`);
        }
        this.scheduledTasks.clear();
        console.log("All scheduled tasks stopped");
    }
}
