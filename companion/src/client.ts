import WebSocket from 'ws';
import os from 'os';
import { CompanionMessage } from './types';
import { handleExec, handleFileRead, handleFileWrite, handleScreenshot } from './handlers';

export class CompanionClient {
  private ws!: WebSocket;
  private reconnectInterval = 5000;
  private shouldReconnect = true;

  constructor(private serverUrl: string, private token: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve) => {
      const url = `${this.serverUrl}?token=${this.token}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('✅ Connected to CrackedClaw');
        this.send({
          id: 'init',
          type: 'capabilities',
          data: {
            os: process.platform,
            arch: process.arch,
            hostname: os.hostname(),
            tools: ['exec', 'file_read', 'file_write', 'screenshot'],
          },
        });
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg: CompanionMessage = JSON.parse(data.toString());
          this.handleMessage(msg).catch((err) => {
            console.error('Handler error:', err.message);
            this.sendResult(msg.id, null, err.message);
          });
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from CrackedClaw');
        if (this.shouldReconnect) {
          this.reconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error('Connection error:', err.message);
      });
    });
  }

  private async handleMessage(msg: CompanionMessage): Promise<void> {
    console.log(`📨 Received: ${msg.type} [${msg.id}]`);
    switch (msg.type) {
      case 'exec': {
        const result = await handleExec(msg.data);
        this.sendResult(msg.id, result);
        break;
      }
      case 'file_read': {
        const result = await handleFileRead(msg.data);
        this.sendResult(msg.id, result);
        break;
      }
      case 'file_write': {
        const result = await handleFileWrite(msg.data);
        this.sendResult(msg.id, result);
        break;
      }
      case 'screenshot': {
        const result = await handleScreenshot();
        this.sendResult(msg.id, result);
        break;
      }
      case 'ping':
        this.send({ id: msg.id, type: 'pong' });
        break;
      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  }

  send(msg: CompanionMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendResult(id: string, data: any, error?: string): void {
    this.send({
      id,
      type: 'result',
      data: error ? { error } : data,
    });
  }

  private reconnect(): void {
    console.log(`🔄 Reconnecting in ${this.reconnectInterval / 1000}s...`);
    setTimeout(() => this.connect(), this.reconnectInterval);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
