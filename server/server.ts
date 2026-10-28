import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import categoryRoutes from "./routes/categoryRoutes.ts";
import uploadRouter from "./routes/uploadRoutes.ts";
import storeRouter from "./routes/storeRoutes.ts";
import productRouter from "./routes/productRoutes.ts";
import orderRouter from "./routes/orderRoutes.ts";
import analyticsRoutes from "./routes/analyticsRoutes.ts";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const port = process.env.PORT || 5000;

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
});

// API Routes
app.use("/api/categories", categoryRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/stores", storeRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.use("/api/analytics", analyticsRoutes);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
