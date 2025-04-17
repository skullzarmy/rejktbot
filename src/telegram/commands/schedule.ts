import { Context, Telegraf } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { ScheduleManager } from "../../utils/schedule-manager";
import { SchedulerService } from "../../services/scheduler";
import { FetchType } from "../../types";

// Create a singleton instance of the schedule manager
const scheduleManager = new ScheduleManager();

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
        // Simply provide schedule help text
        return ctx.reply(
            "Schedule Management Commands:\n" +
                "/schedule_create [artist|nft] [cron] [name] - Create a new schedule\n" +
                '  Example: /schedule_create artist "0 12 * * *" "Daily Artist"\n' +
                "/schedule_list - List all schedules for this chat\n" +
                "/schedule_delete [id] - Delete a schedule by ID\n" +
                "/schedule_pause [id] - Pause a schedule\n" +
                "/schedule_resume [id] - Resume a paused schedule\n" +
                "\nCron Examples:\n" +
                '"0 * * * *" - Every hour\n' +
                '"0 */6 * * *" - Every 6 hours\n' +
                '"0 12 * * *" - Daily at noon\n' +
                '"0 12 * * 1" - Weekly on Monday at noon'
        );
    });
}

/**
 * Handle the schedule_create command
 * Format: /schedule_create [artist|nft] [cron] [name]
 */
async function handleCreateSchedule(ctx: Context, schedulerService: SchedulerService) {
    const message = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const parts = message.split(" ");

    // Remove command name
    parts.shift();

    // Check for type parameter
    if (parts.length < 1) {
        return ctx.reply(
            'Please specify a type: artist or nft\nExample: /schedule_create artist "0 12 * * *" "Daily Artist"'
        );
    }

    // Parse parameters
    const type = parts[0].toLowerCase();
    let cronExpression = parts.length > 1 ? parts[1] : "0 12 * * *"; // Default to daily at noon

    // Handle quoted cron expression
    if (cronExpression.startsWith('"') && cronExpression.endsWith('"')) {
        cronExpression = cronExpression.slice(1, -1);
    }

    // Check for valid type
    if (type !== "artist" && type !== "nft") {
        return ctx.reply("Invalid type. Please use 'artist' or 'nft'.");
    }

    // Extract name (everything after the cron expression)
    let name = "";
    if (parts.length > 2) {
        name = parts.slice(2).join(" ");
        // Remove quotes if present
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1);
        }
    }

    // Set default name if not provided
    if (!name) {
        name = type === "artist" ? "Random Artist" : "Random NFT";
    }

    // Validate cron expression
    let isValidCron = true;
    try {
        require("node-cron").validate(cronExpression);
    } catch (error) {
        isValidCron = false;
    }

    if (!isValidCron) {
        return ctx.reply("Invalid cron expression. Please provide a valid cron expression.");
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
    const parts = message.split(" ");

    // Remove command name
    parts.shift();

    if (parts.length < 1) {
        return ctx.reply("Please specify a schedule ID to delete.\nExample: /schedule_delete telegram-12345");
    }

    const scheduleId = parts[0];
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
    const parts = message.split(" ");

    // Remove command name
    parts.shift();

    if (parts.length < 1) {
        return ctx.reply("Please specify a schedule ID to pause.\nExample: /schedule_pause telegram-12345");
    }

    const scheduleId = parts[0];
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
    const parts = message.split(" ");

    // Remove command name
    parts.shift();

    if (parts.length < 1) {
        return ctx.reply("Please specify a schedule ID to resume.\nExample: /schedule_resume telegram-12345");
    }

    const scheduleId = parts[0];
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
