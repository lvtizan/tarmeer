"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");

function sign(secret, timestamp, rawBody) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}\n${rawBody}`).digest("hex");
}

function verify(secret, timestamp, rawBody, sig) {
  const ts = Number(timestamp);
  if (!timestamp || Number.isNaN(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false; // ±5 分钟防重放
  if (typeof sig !== "string") return false;
  const expected = sign(secret, timestamp, rawBody);
  if (sig.length !== expected.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
