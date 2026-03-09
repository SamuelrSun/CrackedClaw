"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanionClient = void 0;
const ws_1 = __importDefault(require("ws"));
const os_1 = __importDefault(require("os"));
const handlers_1 = require("./handlers");
class CompanionClient {
    constructor(serverUrl, token) {
        this.serverUrl = serverUrl;
        this.token = token;
        this.reconnectInterval = 5000;
        this.shouldReconnect = true;
    }
    async connect() {
        return new Promise((resolve) => {
            const url = `${this.serverUrl}?token=${this.token}`;
            this.ws = new ws_1.default(url);
            this.ws.on('open', () => {
                console.log('✅ Connected to CrackedClaw');
                this.send({
                    id: 'init',
                    type: 'capabilities',
                    data: {
                        os: process.platform,
                        arch: process.arch,
                        hostname: os_1.default.hostname(),
                        tools: ['exec', 'file_read', 'file_write', 'screenshot'],
                    },
                });
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMessage(msg).catch((err) => {
                        console.error('Handler error:', err.message);
                        this.sendResult(msg.id, null, err.message);
                    });
                }
                catch (err) {
                    console.error('Failed to parse message:', err);
                }
            });
            this.ws.on('close', () => {
                console.log('🔌 Disconnected from CrackedClaw');
                if (this.shouldReconnect) {
                    this.reconnect();
                }
            });
            this.ws.on('error', (err) => {
                console.error('Connection error:', err.message);
            });
        });
    }
    async handleMessage(msg) {
        console.log(`📨 Received: ${msg.type} [${msg.id}]`);
        switch (msg.type) {
            case 'exec': {
                const result = await (0, handlers_1.handleExec)(msg.data);
                this.sendResult(msg.id, result);
                break;
            }
            case 'file_read': {
                const result = await (0, handlers_1.handleFileRead)(msg.data);
                this.sendResult(msg.id, result);
                break;
            }
            case 'file_write': {
                const result = await (0, handlers_1.handleFileWrite)(msg.data);
                this.sendResult(msg.id, result);
                break;
            }
            case 'screenshot': {
                const result = await (0, handlers_1.handleScreenshot)();
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
    send(msg) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    sendResult(id, data, error) {
        this.send({
            id,
            type: 'result',
            data: error ? { error } : data,
        });
    }
    reconnect() {
        console.log(`🔄 Reconnecting in ${this.reconnectInterval / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectInterval);
    }
    disconnect() {
        this.shouldReconnect = false;
        this.ws?.close();
    }
}
exports.CompanionClient = CompanionClient;
//# sourceMappingURL=client.js.map