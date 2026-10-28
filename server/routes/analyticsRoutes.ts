import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import {
  getMerchantAnalytics,
  getPlatformAnalytics,
} from "../controllers/analyticsController.ts";

const analyticsRoutes = Router();

analyticsRoutes.get(
  "/merchant",
  requireAuth,
  requireRole(["merchant"]),
  getMerchantAnalytics,
);
analyticsRoutes.get(
  "/platform",
  requireAuth,
  requireRole(["admin"]),
  getPlatformAnalytics,
);

export default analyticsRoutes;
