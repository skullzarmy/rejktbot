# REJKTbot

A multi-platform bot for Discord and Telegram that provides NFT and artist discovery services.

## Overview

REJKTbot is a server-side bot application that enables users to discover random NFT artwork and artists via both Discord and Telegram platforms. It features on-demand commands and scheduled posting capabilities.

## Features

-   **Multi-Platform Support**: Works with both Discord and Telegram
-   **Artist Discovery**: Fetch and display random artists with their profile information
-   **NFT Discovery**: Fetch and display random NFTs with pricing and description
-   **Scheduling System**: Set up automated posting schedules with cron expressions
-   **Admin Controls**: Pause, resume, and delete schedules
-   **User Permissions**: Only creators and admins can manage schedules

## Commands

### Discord Commands

-   `/random-artist` - Get a random artist
-   `/random-nft` - Get a random NFT
-   `/schedule create` - Create a new scheduled post
-   `/schedule list` - List all schedules for the current channel
-   `/schedule delete` - Delete a schedule
-   `/schedule pause` - Pause a schedule
-   `/schedule resume` - Resume a paused schedule

### Telegram Commands

-   `/random_artist` - Get a random artist
-   `/random_nft` - Get a random NFT
-   `/schedule_create [artist|nft] [cron] [name]` - Create a new scheduled post
-   `/schedule_list` - List all schedules for the current chat
-   `/schedule_delete [id]` - Delete a schedule by ID
-   `/schedule_pause [id]` - Pause a schedule
-   `/schedule_resume [id]` - Resume a paused schedule

## Setup

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables (create a `.env` file with the following):

```
DISCORD_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_discord_client_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ARTIST_ENDPOINT=your_artist_api_endpoint
NFT_ENDPOINT=your_nft_api_endpoint
API_KEY=your_api_key
```

4. Build the TypeScript files:

```bash
npm run build
```

5. Start the bot:

```bash
npm start
```

## Project Structure

-   `src/` - Source code directory
    -   `config.ts` - Configuration and environment variables
    -   `index.ts` - Main application entry point
    -   `discord/` - Discord bot implementation
        -   `commands/` - Discord command handlers
    -   `telegram/` - Telegram bot implementation
        -   `commands/` - Telegram command handlers
    -   `services/` - Shared services
        -   `api.ts` - API interaction service
        -   `scheduler.ts` - Scheduling service
    -   `types/` - TypeScript type definitions
    -   `utils/` - Utility functions and helpers

## Scheduling

The bot supports scheduling posts using cron expressions. Here are some examples:

-   `0 * * * *` - Every hour
-   `0 */6 * * *` - Every 6 hours
-   `0 */12 * * *` - Every 12 hours
-   `0 12 * * *` - Daily at noon
-   `0 12 * * 1` - Weekly on Monday at noon

## Development

### Prerequisites

-   Node.js v16 or higher
-   npm or bun package manager

### Building

```bash
npm run build
```

### Running in Development Mode

```bash
npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
