import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// UptimeRobot keep-alive endpoint
// Monitor this URL every 5 minutes: GET /api/ping
router.get("/ping", (_req, res) => {
  res.json({ status: 200, message: "pong" });
});

export default router;
