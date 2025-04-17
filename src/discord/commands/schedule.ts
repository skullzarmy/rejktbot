import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    TextChannel,
    ChannelType,
    MessageFlags,
} from "discord.js";
import { ScheduleManager } from "../../utils/schedule-manager";
import { SchedulerService } from "../../services/scheduler";
import { FetchType } from "../../types";

// Get the singleton instance of the schedule manager
const scheduleManager = ScheduleManager.getInstance();

// Build the command using SlashCommandBuilder
// Export this as 'data' for Discord.js to recognize it
export const data = new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Manage automated schedules for this channel")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("create")
            .setDescription("Create a new schedule for this channel")
            .addStringOption((option) =>
                option
                    .setName("type")
                    .setDescription("The type of content to schedule")
                    .setRequired(true)
                    .addChoices({ name: "Random Artist", value: "artist" }, { name: "Random NFT", value: "nft" })
            )
            .addStringOption((option) =>
                option
                    .setName("frequency")
                    .setDescription("How often to post (preset options)")
                    .setRequired(false)
                    .addChoices(
                        { name: "Hourly", value: "0 * * * *" },
                        { name: "Every 6 hours", value: "0 */6 * * *" },
                        { name: "Every 12 hours", value: "0 */12 * * *" },
                        { name: "Daily", value: "0 12 * * *" },
                        { name: "Weekly", value: "0 12 * * 1" }
                    )
            )
            .addStringOption((option) =>
                option.setName("cron").setDescription("Custom cron expression (overrides frequency)").setRequired(false)
            )
            .addStringOption((option) =>
                option.setName("name").setDescription("A name for this schedule (optional)").setRequired(false)
            )
    )
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List all schedules for this channel"))
    .addSubcommand((subcommand) =>
        subcommand
            .setName("delete")
            .setDescription("Delete a schedule")
            .addStringOption((option) =>
                option
                    .setName("id")
                    .setDescription("The ID of the schedule to delete")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("pause")
            .setDescription("Pause a schedule")
            .addStringOption((option) =>
                option
                    .setName("id")
                    .setDescription("The ID of the schedule to pause")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("resume")
            .setDescription("Resume a paused schedule")
            .addStringOption((option) =>
                option
                    .setName("id")
                    .setDescription("The ID of the schedule to resume")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    );

export async function execute(interaction: ChatInputCommandInteraction, schedulerService: SchedulerService) {
    // Only allow this command in text channels
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "This command can only be used in text channels.", ephemeral: true });
        return;
    }

    const channel = interaction.channel as TextChannel;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case "create":
            await handleCreateSchedule(interaction, channel, schedulerService);
            break;
        case "list":
            await handleListSchedules(interaction, channel);
            break;
        case "delete":
            await handleDeleteSchedule(interaction, channel, schedulerService);
            break;
        case "pause":
            await handlePauseSchedule(interaction, channel, schedulerService);
            break;
        case "resume":
            await handleResumeSchedule(interaction, channel, schedulerService);
            break;
        default:
            await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    }
}

async function handleCreateSchedule(
    interaction: ChatInputCommandInteraction,
    channel: TextChannel,
    schedulerService: SchedulerService
) {
    await interaction.deferReply();

    const fetchType = interaction.options.getString("type") as FetchType;
    const presetFrequency = interaction.options.getString("frequency");
    const customCron = interaction.options.getString("cron");
    const customName = interaction.options.getString("name");

    const cronExpression = customCron || presetFrequency || "0 12 * * *"; // Default to daily at noon

    // Validate the cron expression
    let isValidCron = true;
    try {
        require("node-cron").validate(cronExpression);
    } catch (error) {
        isValidCron = false;
    }

    if (!isValidCron) {
        await interaction.editReply("Invalid cron expression. Please provide a valid cron expression.");
        return;
    }

    // Generate a name if not provided
    const defaultNameMap: { [key in FetchType]: string } = {
        artist: "Random Artist",
        nft: "Random NFT",
    };
    const name = customName || `${defaultNameMap[fetchType]} (${channel.name})`;

    try {
        // Create the schedule
        const schedule = await scheduleManager.createUserSchedule({
            name,
            fetchType,
            cronExpression,
            platform: "discord",
            channelId: channel.id,
            guildId: channel.guildId,
            userId: interaction.user.id,
            username: interaction.user.username,
        });

        // Add the schedule to the scheduler service
        schedulerService.addSchedule(schedule);

        // Create an embed to show the schedule details
        const embed = new EmbedBuilder()
            .setTitle("Schedule Created")
            .setColor("#00ff00")
            .setDescription(`A new schedule has been created for this channel.`)
            .addFields(
                { name: "Name", value: schedule.name },
                { name: "Type", value: fetchType === "artist" ? "Random Artist" : "Random NFT" },
                { name: "Frequency", value: prettyPrintCron(cronExpression) },
                { name: "ID", value: schedule.id }
            )
            .setFooter({ text: `Created by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Error creating schedule:", error);
        await interaction.editReply("There was an error creating the schedule. Please try again later.");
    }
}

async function handleListSchedules(interaction: ChatInputCommandInteraction, channel: TextChannel) {
    await interaction.deferReply();

    // Get all schedules for this channel
    const schedules = scheduleManager.getDiscordChannelSchedules(channel.id, channel.guildId);

    if (schedules.length === 0) {
        await interaction.editReply("No schedules found for this channel. Create one with `/schedule create`.");
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("Schedules for this channel")
        .setColor("#0099ff")
        .setDescription(`Found ${schedules.length} schedule(s) for this channel.`)
        .setFooter({ text: `Use /schedule delete to remove a schedule` });

    schedules.forEach((schedule, index) => {
        const status = schedule.enabled ? "✅ Active" : "⏸️ Paused";
        const creator = schedule.createdBy?.username || "Unknown";

        embed.addFields({
            name: `${index + 1}. ${schedule.name} (${status})`,
            value: [
                `**ID:** \`${schedule.id}\``,
                `**Type:** ${schedule.fetchType === "artist" ? "Random Artist" : "Random NFT"}`,
                `**Schedule:** ${prettyPrintCron(schedule.cronExpression)}`,
                `**Created by:** ${creator}`,
            ].join("\n"),
        });
    });

    await interaction.editReply({ embeds: [embed] });
}

async function handleDeleteSchedule(
    interaction: ChatInputCommandInteraction,
    channel: TextChannel,
    schedulerService: SchedulerService
) {
    await interaction.deferReply({ ephemeral: true });

    const scheduleId = interaction.options.getString("id", true);

    // Check if the schedule exists and is for this channel
    const schedule = scheduleManager.getSchedule(scheduleId);

    if (!schedule || schedule.discord?.channelId !== channel.id) {
        await interaction.editReply("Schedule not found or not associated with this channel.");
        return;
    }

    // Check permissions (creator or admin)
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || false;
    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "discord", interaction.user.id, isAdmin);

    if (!canManage) {
        await interaction.editReply(
            "You don't have permission to delete this schedule. Only the creator or admins can delete it."
        );
        return;
    }

    try {
        // Stop the scheduled task
        schedulerService.removeSchedule(scheduleId);

        // Delete the schedule from storage
        await scheduleManager.deleteSchedule(scheduleId);

        await interaction.editReply(`Schedule "${schedule.name}" deleted successfully.`);
    } catch (error) {
        console.error("Error deleting schedule:", error);
        await interaction.editReply("There was an error deleting the schedule. Please try again later.");
    }
}

async function handlePauseSchedule(
    interaction: ChatInputCommandInteraction,
    channel: TextChannel,
    schedulerService: SchedulerService
) {
    await interaction.deferReply({ ephemeral: true });

    const scheduleId = interaction.options.getString("id", true);

    // Check if the schedule exists and is for this channel
    const schedule = scheduleManager.getSchedule(scheduleId);

    if (!schedule || schedule.discord?.channelId !== channel.id) {
        await interaction.editReply("Schedule not found or not associated with this channel.");
        return;
    }

    // Check permissions (creator or admin)
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || false;
    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "discord", interaction.user.id, isAdmin);

    if (!canManage) {
        await interaction.editReply(
            "You don't have permission to pause this schedule. Only the creator or admins can manage it."
        );
        return;
    }

    // If already paused
    if (!schedule.enabled) {
        await interaction.editReply(`Schedule "${schedule.name}" is already paused.`);
        return;
    }

    try {
        // Update the schedule to disabled
        schedule.enabled = false;
        await scheduleManager.updateSchedule(schedule);

        // Remove from scheduler service
        schedulerService.removeSchedule(scheduleId);

        await interaction.editReply(`Schedule "${schedule.name}" paused successfully.`);
    } catch (error) {
        console.error("Error pausing schedule:", error);
        await interaction.editReply("There was an error pausing the schedule. Please try again later.");
    }
}

async function handleResumeSchedule(
    interaction: ChatInputCommandInteraction,
    channel: TextChannel,
    schedulerService: SchedulerService
) {
    await interaction.deferReply({ ephemeral: true });

    const scheduleId = interaction.options.getString("id", true);

    // Check if the schedule exists and is for this channel
    const schedule = scheduleManager.getSchedule(scheduleId);

    if (!schedule || schedule.discord?.channelId !== channel.id) {
        await interaction.editReply("Schedule not found or not associated with this channel.");
        return;
    }

    // Check permissions (creator or admin)
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || false;
    const canManage = scheduleManager.canUserManageSchedule(scheduleId, "discord", interaction.user.id, isAdmin);

    if (!canManage) {
        await interaction.editReply(
            "You don't have permission to resume this schedule. Only the creator or admins can manage it."
        );
        return;
    }

    // If already enabled
    if (schedule.enabled) {
        await interaction.editReply(`Schedule "${schedule.name}" is already active.`);
        return;
    }

    try {
        // Update the schedule to enabled
        schedule.enabled = true;
        await scheduleManager.updateSchedule(schedule);

        // Add to scheduler service
        schedulerService.addSchedule(schedule);

        await interaction.editReply(`Schedule "${schedule.name}" resumed successfully.`);
    } catch (error) {
        console.error("Error resuming schedule:", error);
        await interaction.editReply("There was an error resuming the schedule. Please try again later.");
    }
}

/**
 * Convert a cron expression to a human-readable string
 */
function prettyPrintCron(cron: string): string {
    // Some simple cron patterns
    if (cron === "0 * * * *") return "Every hour";
    if (cron === "0 */6 * * *") return "Every 6 hours";
    if (cron === "0 */12 * * *") return "Every 12 hours";
    if (cron === "0 0 * * *") return "Daily at midnight";
    if (cron === "0 12 * * *") return "Daily at noon";
    if (cron === "0 12 * * 1") return "Weekly on Monday at noon";

    // Return the raw cron for complex patterns
    return `Custom schedule (${cron})`;
}
