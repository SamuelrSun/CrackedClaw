#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const client_1 = require("./client");
const program = new commander_1.Command();
program
    .name('dopl-connect')
    .description('Connect your computer to Dopl')
    .requiredOption('--token <token>', 'Your Dopl connection token')
    .option('--server <url>', 'Server URL', 'wss://www.crackedclaw.com/api/companion/ws')
    .action(async (opts) => {
    console.log('🔌 Dopl Connect');
    console.log('   Connecting to server...');
    const client = new client_1.CompanionClient(opts.server, opts.token);
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Disconnecting...');
        client.disconnect();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        client.disconnect();
        process.exit(0);
    });
    await client.connect();
    // Keep process alive
    await new Promise(() => { });
});
program.parse();
//# sourceMappingURL=index.js.map