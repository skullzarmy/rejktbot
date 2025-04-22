import { Context, Telegraf } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { ScheduleManager } from "../../utils/schedule-manager";
import { SchedulerService } from "../../services/scheduler";
import { FetchType } from "../../types";

/**
 * Parse command arguments with proper quote handling
 * Handles quoted arguments as single arguments
 */
function parseCommandArguments(text: string): string[] {
    const args: string[] = [];
    const pattern = /"([^"]+)"|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        if (match[1] !== undefined) {
            args.push(match[1]);
        } else if (match[2] !== undefined) {
            args.push(match[2]);
        }
    }
    return args;
}

// Get the singleton instance of the schedule manager
const scheduleManager = ScheduleManager.getInstance();

/**
 * Register schedule commands with a Telegram bot
 */
export function registerScheduleCommands(bot: Telegraf, schedulerService: SchedulerService) {
    // Command to create a schedule
    bot.command("schedule_create", (ctx) => handleCreateSchedule(ctx, schedulerService));

    // Command to list schedules
    bot.command("schedule_list", (ctx) => handleListSchedules(ctx));

    // Command to delete a schedule
    bot.command("schedule_delete", (ctx) => handleDeleteSchedule(ctx, schedulerService));

    // Command to pause a schedule
    bot.command("schedule_pause", (ctx) => handlePauseSchedule(ctx, schedulerService));

    // Command to resume a schedule
    bot.command("schedule_resume", (ctx) => handleResumeSchedule(ctx, schedulerService));

    // Add help text for schedule commands
    bot.help((ctx) => {
        return ctx.reply(
            "Schedule Commands:\n" +
                "  /schedule_create [artist|nft] [frequency or cron] [name]\n" +
                "    Examples:\n" +
                '      /schedule_create artist daily "Daily Artist"\n' +
                '      /schedule_create nft every 15 minutes "Quick NFT"\n' +
                '      /schedule_create artist "0 8 * * 1-5" "Weekday Morning"\n' +
                "  /schedule_list - Show all schedules in this chat\n" +
                "  /schedule_delete [id] - Delete a schedule\n" +
                "  /schedule_pause [id] - Pause a schedule\n" +
                "  /schedule_resume [id] - Resume a paused schedule\n" +
                "\nFrequency Options:\n" +
                "  hourly           - every hour\n" +
                "  daily            - every day at noon\n" +
                "  weekly           - every week on Monday at noon\n" +
                "  every X minutes   - choose 1 to 59 minutes\n" +
                "  every X hours     - choose 1 to 23 hours\n" +
                "  Or supply any valid cron expression in quotes."
        );
    });
}

/**
 * Handle the schedule_create command
 * Format: /schedule_create [artist|nft] [frequency/cron] [name]
 */
async function handleCreateSchedule(ctx: Context, schedulerService: SchedulerService) {
    const message = ctx.message && "text" in ctx.message ? ctx.message.text : "";

    // Parse command arguments with proper quote handling
    const args = parseCommandArguments(message);

    // First argument is the command itself
    const command = args.shift();

    // Check for type parameter
    if (args.length < 1) {
        return ctx.reply(
            "Usage: /schedule_create [artist|nft] [frequency or cron] [name]\n\n" +
                "Examples:\n" +
                '  /schedule_create artist daily "Daily Artist"\n' +
                '  /schedule_create nft every 15 minutes "Quick NFT"\n' +
                '  /schedule_create artist "0 8 * * 1-5" "Weekday Morning"\n\n' +
                "Frequency options:\n" +
                "  hourly           - every hour\n" +
                "  daily            - every day at noon\n" +
                "  weekly           - every week on Monday at noon\n" +
                "  every X minutes   - 1 to 59 minutes\n" +
                "  every X hours     - 1 to 23 hours\n" +
                "  or a custom cron expression in quotes"
        );
    }

    // Parse parameters
    const type = args[0].toLowerCase();

    // Check for valid type
    if (type !== "artist" && type !== "nft") {
        return ctx.reply("Invalid type. Please use 'artist' or 'nft'.");
    }

    // Get cron expression (default to daily at noon if not provided)
    let cronExpression = args.length > 1 ? args[1] : "daily";

    // Get name (default to type-based name if not provided)
    let name = args.length > 2 ? args[2] : type === "artist" ? "Random Artist" : "Random NFT";

    // Map friendly names and dynamic phrases to cron expressions
    const freqLower = cronExpression.toLowerCase();
    if (freqLower === "hourly" || freqLower === "every hour") cronExpression = "0 * * * *";
    else if (freqLower === "daily" || freqLower === "every day") cronExpression = "0 12 * * *";
    else if (freqLower === "weekly" || freqLower === "every week") cronExpression = "0 12 * * 1";
    else {
        const everyMinMatch = freqLower.match(/^every\s+(\d+)\s+minutes?$/);
        if (everyMinMatch) {
            const minutes = parseInt(everyMinMatch[1], 10);
            if (minutes >= 1 && minutes <= 59) {
                cronExpression = `*/${minutes} * * * *`;
            }
        } else {
            const everyHourMatch = freqLower.match(/^every\s+(\d+)\s+hours?$/);
            if (everyHourMatch) {
                const hours = parseInt(everyHourMatch[1], 10);
                if (hours >= 1 && hours <= 23) {
                    cronExpression = `0 */${hours} * * *`;
                }
            }
        }
    }

    // Validate cron expression
    let isValidCron = true;
    try {
        require("node-cron").validate(cronExpression);
    } catch (error) {
        isValidCron = false;
    }

    if (!isValidCron) {
        return ctx.reply(
            "Invalid schedule format. Please use one of these options:\n" +
                "- hourly (posts every hour)\n" +
                "- daily (posts at noon every day)\n" +
                "- weekly (posts Mondays at noon)\n" +
                "- every6hours (posts every 6 hours)\n" +
                "- every12hours (posts every 12 hours)\n" +
                '- Or a custom cron expression like "0 12 * * *"'
        );
    }

    try {
        // Get chat info
        const chatId = ctx.chat?.id.toString();
        if (!chatId) {
            return ctx.reply("Could not determine chat ID. Please try again.");
        }

        // Get user info
        const userId = ctx.from?.id.toString();
        const username = ctx.from?.username || ctx.from?.first_name || "Anonymous";

        if (!userId) {
            return ctx.reply("Could not determine user ID. Please try again.");
        }

        // Create the schedule
        const schedule = await scheduleManager.createUserSchedule({
            name,
            fetchType: type as FetchType,
            cronExpression,
            platform: "telegram",
            chatId,
            userId,
            username,
        });

        // Add the schedule to the scheduler service
        schedulerService.addSchedule(schedule);

        // Format the cron expression nicely
        let cronDescription = cronExpression;
        if (cronExpression === "0 * * * *") cronDescription = "Every hour";
        else if (cronExpression === "0 */6 * * *") cronDescription = "Every 6 hours";
        else if (cronExpression === "0 */12 * * *") cronDescription = "Every 12 hours";
        else if (cronExpression === "0 0 * * *") cronDescription = "Daily at midnight";
        else if (cronExpression === "0 12 * * *") cronDescription = "Daily at noon";
        else if (cronExpression === "0 12 * * 1") cronDescription = "Weekly on Monday at noon";

        return ctx.reply(
            `✅ Schedule created successfully!\n\n` +
                `Name: ${schedule.name}\n` +
                `Type: ${schedule.fetchType === "artist" ? "Random Artist" : "Random NFT"}\n` +
                `Schedule: ${cronDescription}\n` +
                `ID: ${schedule.id}`
        );
    } catch (error) {
        console.error("Error creating schedule:", error);
        return ctx.reply("There was an error creating the schedule. Please try again later.");
    }
}

/**
 * Handle the schedule_list command
 */
async function handleListSchedules(ctx: Context) {
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
        return ctx.reply("Could not determine chat ID. Please try again.");
    }

    // Get all schedules for this chat
    const schedules = scheduleManager.getTelegramChatSchedules(chatId);

    if (schedules.length === 0) {
        return ctx.reply("No schedules found for this chat. Create one with /schedule_create");
    }

    let message = `📅 Schedules for this chat:\n\n`;

    schedules.forEach((schedule, index) => {
        const status = schedule.enabled ? "✅ Active" : "⏸️ Paused";
        const creator = schedule.createdBy?.username || "Unknown";

        // Format the cron expression nicely
        let cronDescription = schedule.cronExpression;
        if (schedule.cronExpression === "0 * * * *") cronDescription = "Every hour";
        else if (schedule.cronExpression === "0 */6 * * *") cronDescription = "Every 6 hours";
        else if (schedule.cronExpression === "0 */12 * * *") cronDescription = "Every 12 hours";
        else if (schedule.cronExpression === "0 0 * * *") cronDescription = "Daily at midnight";
        else if (schedule.cronExpression === "0 12 * * *") cronDescription = "Daily at noon";
        else if (schedule.cronExpression === "0 12 * * 1") cronDescription = "Weekly on Monday at noon";

        message += `${index + 1}. ${schedule.name} (${status})\n`;
        message += `   Type: ${schedule.fetchType === "artist" ? "Random Artist" : "Random NFT"}\n`;
        message += `   Schedule: ${cronDescription}\n`;
        message += `   Created by: ${creator}\n`;
        message += `   ID: ${schedule.id}\n\n`;
    });

    return ctx.reply(message);
}

/**
 * Handle the schedule_delete command
 */
async function handleDeleteSchedule(ctx: Context, schedulerService: SchedulerService) {
    const message = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const args = parseCommandArguments(message);
    args.shift(); // Remove command name

    if (args.length < 1) {
        return ctx.reply("Please specify a schedule ID to delete.\nExample: /schedule_delete telegram-12345");
    }

    const scheduleId = args[0];
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
        return ctx.reply("Could not determine chat ID. Please try again.");
    }

    // Get the schedule
    const schedule = scheduleManager.getSchedule(scheduleId);

    // Check if schedule exists and belongs to this chat
    if (!schedule || schedule.telegram?.chatId !== chatId) {
        return ctx.reply("Schedule not found or not associated with this chat.");
    }

    // Check if user has permission to delete this schedule
    const userId = ctx.from?.id.toString();
    if (!userId) {
        return ctx.reply("Could not determine user ID. Please try again.");
    }

    // Determine if user is an admin (simplify the check to avoid type errors)
    const isAdmin = ctx.chat?.type === "private" || false;

    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "telegram", userId, isAdmin);

    if (!canManage) {
        return ctx.reply(
            "You don't have permission to delete this schedule. Only the creator or admins can delete it."
        );
    }

    try {
        // Stop the scheduled task
        schedulerService.removeSchedule(scheduleId);

        // Delete the schedule from storage
        await scheduleManager.deleteSchedule(scheduleId);

        return ctx.reply(`Schedule "${schedule.name}" deleted successfully.`);
    } catch (error) {
        console.error("Error deleting schedule:", error);
        return ctx.reply("There was an error deleting the schedule. Please try again later.");
    }
}

/**
 * Handle the schedule_pause command
 */
async function handlePauseSchedule(ctx: Context, schedulerService: SchedulerService) {
    const message = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const args = parseCommandArguments(message);
    args.shift(); // Remove command name

    if (args.length < 1) {
        return ctx.reply("Please specify a schedule ID to pause.\nExample: /schedule_pause telegram-12345");
    }

    const scheduleId = args[0];
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
        return ctx.reply("Could not determine chat ID. Please try again.");
    }

    // Get the schedule
    const schedule = scheduleManager.getSchedule(scheduleId);

    // Check if schedule exists and belongs to this chat
    if (!schedule || schedule.telegram?.chatId !== chatId) {
        return ctx.reply("Schedule not found or not associated with this chat.");
    }

    // Check if user has permission to manage this schedule
    const userId = ctx.from?.id.toString();
    if (!userId) {
        return ctx.reply("Could not determine user ID. Please try again.");
    }

    // Determine if user is an admin (simplify the check to avoid type errors)
    const isAdmin = ctx.chat?.type === "private" || false;

    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "telegram", userId, isAdmin);

    if (!canManage) {
        return ctx.reply("You don't have permission to pause this schedule. Only the creator or admins can manage it.");
    }

    // If already paused
    if (!schedule.enabled) {
        return ctx.reply(`Schedule "${schedule.name}" is already paused.`);
    }

    try {
        // Update the schedule to disabled
        schedule.enabled = false;
        await scheduleManager.updateSchedule(schedule);

        // Remove from scheduler service
        schedulerService.removeSchedule(scheduleId);

        return ctx.reply(`Schedule "${schedule.name}" paused successfully.`);
    } catch (error) {
        console.error("Error pausing schedule:", error);
        return ctx.reply("There was an error pausing the schedule. Please try again later.");
    }
}

/**
 * Handle the schedule_resume command
 */
async function handleResumeSchedule(ctx: Context, schedulerService: SchedulerService) {
    const message = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const args = parseCommandArguments(message);
    args.shift(); // Remove command name

    if (args.length < 1) {
        return ctx.reply("Please specify a schedule ID to resume.\nExample: /schedule_resume telegram-12345");
    }

    const scheduleId = args[0];
    const chatId = ctx.chat?.id.toString();

    if (!chatId) {
        return ctx.reply("Could not determine chat ID. Please try again.");
    }

    // Get the schedule
    const schedule = scheduleManager.getSchedule(scheduleId);

    // Check if schedule exists and belongs to this chat
    if (!schedule || schedule.telegram?.chatId !== chatId) {
        return ctx.reply("Schedule not found or not associated with this chat.");
    }

    // Check if user has permission to manage this schedule
    const userId = ctx.from?.id.toString();
    if (!userId) {
        return ctx.reply("Could not determine user ID. Please try again.");
    }

    // Determine if user is an admin (simplify the check to avoid type errors)
    const isAdmin = ctx.chat?.type === "private" || false;

    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "telegram", userId, isAdmin);

    if (!canManage) {
        return ctx.reply(
            "You don't have permission to resume this schedule. Only the creator or admins can manage it."
        );
    }

    // If already enabled
    if (schedule.enabled) {
        return ctx.reply(`Schedule "${schedule.name}" is already active.`);
    }

    try {
        // Update the schedule to enabled
        schedule.enabled = true;
        await scheduleManager.updateSchedule(schedule);

        // Add to scheduler service
        schedulerService.addSchedule(schedule);

        return ctx.reply(`Schedule "${schedule.name}" resumed successfully.`);
    } catch (error) {
        console.error("Error resuming schedule:", error);
        return ctx.reply("There was an error resuming the schedule. Please try again later.");
    }
}
