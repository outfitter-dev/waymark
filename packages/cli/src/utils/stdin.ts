// tldr ::: helpers for consuming CLI input streams

/**
 * Read all data from a stream into a string.
 * @param stream - Readable stream to consume.
 * @returns Stream contents as UTF-8 string.
 */
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

/**
 * Read all data from stdin into a string.
 * @returns Stdin contents as UTF-8 string.
 */
export async function readFromStdin(): Promise<string> {
  return await readStream(process.stdin);
}
