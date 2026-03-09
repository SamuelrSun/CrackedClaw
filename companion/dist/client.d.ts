import { CompanionMessage } from './types';
export declare class CompanionClient {
    private serverUrl;
    private token;
    private ws;
    private reconnectInterval;
    private shouldReconnect;
    constructor(serverUrl: string, token: string);
    connect(): Promise<void>;
    private handleMessage;
    send(msg: CompanionMessage): void;
    private sendResult;
    private reconnect;
    disconnect(): void;
}
//# sourceMappingURL=client.d.ts.map