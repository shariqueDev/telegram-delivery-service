import { Router } from "express";

export function createHealthRouter() {
  const r = Router();

  r.get("/", (_req, res) => {
    res.type("text/plain").send("Telegram link delivery API");
  });

  r.get("/health", (req, res) => {
    res.json({ status: true, requestId: req.requestId });
  });

  return r;
}
