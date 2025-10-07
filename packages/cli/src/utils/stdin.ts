// tldr ::: helpers for consuming CLI input streams

export async function readStream(
  stream: NodeJS.ReadableStream
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readFromStdin(): Promise<string> {
  return await readStream(process.stdin);
}
