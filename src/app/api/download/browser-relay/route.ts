import { NextResponse } from "next/server";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";

export async function GET() {
  const extDir = path.join(process.cwd(), "public", "extension", "dopl-browser-relay");

  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(passthrough);
  archive.directory(extDir, "dopl-browser-relay");
  archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of passthrough) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="dopl-browser-relay.zip"',
    },
  });
}
