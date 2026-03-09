import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { ExecData, FileReadData, FileWriteData } from './types';

const execPromise = promisify(exec);

export async function handleExec(data: ExecData): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { command, cwd, timeout = 30000 } = data;
  try {
    const { stdout, stderr } = await execPromise(command, { cwd, timeout });
    return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      exitCode: err.code ?? 1,
    };
  }
}

export async function handleFileRead(data: FileReadData): Promise<{ content: string }> {
  const { path } = data;
  const content = await fs.readFile(path, 'utf-8');
  return { content };
}

export async function handleFileWrite(data: FileWriteData): Promise<{ success: boolean }> {
  const { path, content } = data;
  // Ensure parent directory exists
  const { dirname } = await import('path');
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, 'utf-8');
  return { success: true };
}

export async function handleScreenshot(): Promise<{ image: string }> {
  const tmpFile = `/tmp/cc-screenshot-${Date.now()}.png`;
  await execPromise(`screencapture -x ${tmpFile}`);
  const buffer = await fs.readFile(tmpFile);
  await fs.unlink(tmpFile).catch(() => {});
  return { image: buffer.toString('base64') };
}
