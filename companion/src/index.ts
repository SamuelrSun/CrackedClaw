#!/usr/bin/env node
import { Command } from 'commander';
import { CompanionClient } from './client';

const program = new Command();

program
  .name('dopl-connect')
  .description('Connect your computer to Dopl')
  .requiredOption('--token <token>', 'Your Dopl connection token')
  .option('--server <url>', 'Server URL', 'wss://www.usedopl.com/api/companion/ws')
  .action(async (opts: { token: string; server: string }) => {
    console.log('🔌 Dopl Connect');
    console.log('   Connecting to server...');
    const client = new CompanionClient(opts.server, opts.token);

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
    await new Promise(() => {});
  });

program.parse(process.argv);
