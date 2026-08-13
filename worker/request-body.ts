export class PayloadTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "PayloadTooLargeError";
  }
}

export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const declaredBytes = Number(declaredLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > limit) {
      throw new PayloadTooLargeError();
    }
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > limit) {
      try {
        await reader.cancel();
      } catch {
        // The size rejection is authoritative even if the source cannot be cancelled.
      }
      throw new PayloadTooLargeError();
    }

    raw += decoder.decode(value, { stream: true });
  }

  raw += decoder.decode();
  return JSON.parse(raw || "{}");
}
