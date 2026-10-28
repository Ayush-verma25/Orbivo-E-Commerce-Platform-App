import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  createProduct,
  deleteProduct,
  getMerchantProducts,
  getProducts,
  updateProduct,
} from "../controllers/productController.js";

const productRouter = Router();

productRouter.get("/", getProducts);

productRouter.get(
  "/merchant",
  requireAuth,
  requireRole(["merchant"]),
  getMerchantProducts,
);
productRouter.post("/", requireAuth, requireRole(["merchant"]), createProduct);
productRouter.put(
  "/:id",
  requireAuth,
  requireRole(["merchant"]),
  updateProduct,
);
productRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["merchant"]),
  deleteProduct,
);

export default productRouter;
