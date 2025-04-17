import { validateConfig } from "./config";
import { ApiService } from "./services/api";
import { SchedulerService } from "./services/scheduler";
import { DiscordBot } from "./discord";
import { TelegramBot } from "./telegram";
import { ScheduleManager } from "./utils/schedule-manager";

async function main() {
    // Validate environment variables
    if (!validateConfig()) {
        console.error("Invalid configuration. Exiting...");
        process.exit(1);
    }

    try {
        // Initialize services
        console.log("Initializing services...");
        const apiService = new ApiService();
        const schedulerService = new SchedulerService(apiService);
        const scheduleManager = new ScheduleManager();

        // Initialize bots
        console.log("Initializing bots...");
        const discordBot = new DiscordBot(apiService);
        const telegramBot = new TelegramBot(apiService);

        // Register bots with scheduler
        schedulerService.setDiscordSender(discordBot);
        schedulerService.setTelegramSender(telegramBot);

        // Set scheduler service in bots for command handling
        discordBot.setSchedulerService(schedulerService);
        telegramBot.setSchedulerService(schedulerService);

        // Start the bots
        console.log("Starting bots...");
        try {
            await Promise.all([discordBot.start(), telegramBot.start()]);
        } catch (error) {
            console.error("Error starting one or more bots:", error);
            console.log("Continuing with available bots...");
        }

        // Load and set up scheduled tasks
        console.log("Setting up scheduled tasks...");
        const schedules = await scheduleManager.loadSchedules();
        schedulerService.addScheduledTasks(schedules);

        console.log("Bot is now running. Press CTRL+C to exit.");

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            console.log("Shutting down...");
            schedulerService.stopAllTasks();

            try {
                await Promise.all([discordBot.stop(), telegramBot.stop()]);
            } catch (error) {
                console.error("Error stopping bots:", error);
            }

            console.log("Gracefully shut down. Goodbye!");
            process.exit(0);
        });
    } catch (error) {
        console.error("Error starting the application:", error);
        process.exit(1);
    }
}

// Start the application
main().catch(console.error);
