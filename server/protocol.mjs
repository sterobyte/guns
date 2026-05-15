import crypto from "node:crypto";

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 16 * 1024;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function createAcceptKey(clientKey) {
  return crypto
    .createHash("sha1")
    .update(`${clientKey}${WS_GUID}`)
    .digest("base64");
}

export function encodeFrame(payload, opcode = 0x1) {
  const data = Buffer.from(payload);
  const header = [];

  header.push(0x80 | opcode);

  if (data.length < 126) {
    header.push(data.length);
  } else if (data.length < 65536) {
    header.push(126, (data.length >> 8) & 0xff, data.length & 0xff);
  } else {
    header.push(127, 0, 0, 0, 0);
    header.push(
      (data.length >> 24) & 0xff,
      (data.length >> 16) & 0xff,
      (data.length >> 8) & 0xff,
      data.length & 0xff
    );
  }

  return Buffer.concat([Buffer.from(header), data]);
}

export function encodeJson(message) {
  return encodeFrame(JSON.stringify(message));
}

export function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const high = buffer.readUInt32BE(offset + 2);
      const low = buffer.readUInt32BE(offset + 6);

      if (high !== 0) {
        throw new Error("Message is too large");
      }

      length = low;
      headerLength = 10;
    }

    if (length > MAX_MESSAGE_BYTES) {
      throw new Error("Message is too large");
    }

    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;

    if (frameEnd > buffer.length) break;

    const payloadStart = offset + headerLength + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadStart, frameEnd));

    if (masked) {
      const mask = buffer.subarray(offset + headerLength, payloadStart);

      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    frames.push({
      opcode,
      text: payload.toString("utf8")
    });

    offset = frameEnd;
  }

  return {
    frames,
    rest: buffer.subarray(offset)
  };
}

export function safeJsonParse(text) {
  if (!text || text.length > MAX_MESSAGE_BYTES) return null;

  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
