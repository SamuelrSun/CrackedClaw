import { ExecData, FileReadData, FileWriteData } from './types';
export declare function handleExec(data: ExecData): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}>;
export declare function handleFileRead(data: FileReadData): Promise<{
    content: string;
}>;
export declare function handleFileWrite(data: FileWriteData): Promise<{
    success: boolean;
}>;
export declare function handleScreenshot(): Promise<{
    image: string;
}>;
//# sourceMappingURL=handlers.d.ts.map