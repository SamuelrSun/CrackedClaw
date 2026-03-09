export interface CompanionMessage {
  id: string;
  type: 'exec' | 'file_read' | 'file_write' | 'screenshot' | 'ping' | 'capabilities' | 'result' | 'pong' | 'error';
  data?: any;
}

export interface ExecData {
  command: string;
  cwd?: string;
  timeout?: number;
}

export interface FileReadData {
  path: string;
}

export interface FileWriteData {
  path: string;
  content: string;
}

export interface CapabilitiesData {
  os: string;
  arch: string;
  hostname: string;
  tools: string[];
}
