import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.ts";
import { upload, validateUploadedImages } from "../middleware/upload.ts";
import {
  aiOnModel,
  aiTransform,
  uploadMultiple,
  uploadSingle,
} from "../controllers/uploadController.ts";

const uploadRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req: AuthenticatedRequest) =>
    req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip || "unknown"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many AI requests; try again in a minute" },
});

uploadRouter.post("/single", requireAuth, upload.single("image"), validateUploadedImages, uploadSingle);
uploadRouter.post(
  "/multiple",
  requireAuth,
  upload.array("images", 5),
  validateUploadedImages,
  uploadMultiple,
);
uploadRouter.post("/ai-transform", requireAuth, aiLimiter, aiTransform);
uploadRouter.post("/ai-on-model", requireAuth, aiLimiter, aiOnModel);

export default uploadRouter;
