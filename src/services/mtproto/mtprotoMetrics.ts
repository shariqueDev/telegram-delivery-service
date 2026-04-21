import { Registry, Counter, Histogram } from "prom-client";

export function createMtprotoMetrics() {
  const registry = new Registry();

  const deliveriesTotal = new Counter({
    name: "mtproto_deliveries_total",
    help: "MTProto delivery outcomes",
    labelNames: ["status"],
    registers: [registry],
  });

  const attempts = new Counter({
    name: "mtproto_delivery_attempts_total",
    help: "Send attempts per account",
    labelNames: ["account_id", "result"],
    registers: [registry],
  });

  const floodWait = new Counter({
    name: "mtproto_flood_wait_total",
    help: "Flood wait events per account",
    labelNames: ["account_id"],
    registers: [registry],
  });

  const invalidUsername = new Counter({
    name: "mtproto_invalid_username_total",
    help: "Permanent invalid username / peer failures",
    registers: [registry],
  });

  const attemptsHistogram = new Histogram({
    name: "mtproto_deliver_attempts_per_request",
    help: "Attempts per delivery request",
    buckets: [1, 2, 3, 4, 5, 6],
    registers: [registry],
  });

  return {
    registry,
    deliveriesTotal,
    attempts,
    floodWait,
    invalidUsername,
    attemptsHistogram,
  };
}

export type MtprotoMetrics = ReturnType<typeof createMtprotoMetrics>;
