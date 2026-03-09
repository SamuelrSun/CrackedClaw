"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExec = handleExec;
exports.handleFileRead = handleFileRead;
exports.handleFileWrite = handleFileWrite;
exports.handleScreenshot = handleScreenshot;
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = __importDefault(require("fs/promises"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
async function handleExec(data) {
    const { command, cwd, timeout = 30000 } = data;
    try {
        const { stdout, stderr } = await execPromise(command, { cwd, timeout });
        return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
    }
    catch (err) {
        return {
            stdout: err.stdout || '',
            stderr: err.stderr || err.message || '',
            exitCode: err.code ?? 1,
        };
    }
}
async function handleFileRead(data) {
    const { path } = data;
    const content = await promises_1.default.readFile(path, 'utf-8');
    return { content };
}
async function handleFileWrite(data) {
    const { path, content } = data;
    // Ensure parent directory exists
    const { dirname } = await Promise.resolve().then(() => __importStar(require('path')));
    await promises_1.default.mkdir(dirname(path), { recursive: true });
    await promises_1.default.writeFile(path, content, 'utf-8');
    return { success: true };
}
async function handleScreenshot() {
    const tmpFile = `/tmp/cc-screenshot-${Date.now()}.png`;
    await execPromise(`screencapture -x ${tmpFile}`);
    const buffer = await promises_1.default.readFile(tmpFile);
    await promises_1.default.unlink(tmpFile).catch(() => { });
    return { image: buffer.toString('base64') };
}
//# sourceMappingURL=handlers.js.map