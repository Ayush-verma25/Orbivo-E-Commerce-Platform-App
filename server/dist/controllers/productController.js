import { prisma } from "../config/prisma.js";
const isNonNegativeNumber = (value) => (typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;
const validateProductInput = ({ name, price, stock }, partial = false) => {
    if ((!partial || name !== undefined) &&
        (typeof name !== "string" || !name.trim())) {
        return "Product name must be a non-empty string";
    }
    if ((!partial || price !== undefined) && !isNonNegativeNumber(price)) {
        return "Product price must be a finite non-negative number";
    }
    if (stock !== undefined &&
        (!isNonNegativeNumber(stock) || !Number.isInteger(Number(stock)))) {
        return "Product stock must be a non-negative integer";
    }
    return null;
};
const getMerchantStore = (merchantId) => prisma.stores.findFirst({ where: { merchant_id: merchantId } });
export const getProducts = async (req, res) => {
    try {
        const { storeId, storeSlug, categoryId } = req.query;
        let targetStoreId = null;
        if (storeId !== undefined) {
            const id = Number(storeId);
            if (Number.isInteger(id) && id > 0) {
                targetStoreId = id;
            }
        }
        if (!targetStoreId && typeof storeSlug === "string") {
            const store = await prisma.stores.findUnique({
                where: { slug: storeSlug },
                select: { id: true },
            });
            if (store) {
                targetStoreId = store.id;
            }
        }
        const whereClause = {};
        if (targetStoreId) {
            whereClause.store_id = targetStoreId;
        }
        if (categoryId !== undefined) {
            const catId = Number(categoryId);
            if (Number.isInteger(catId) && catId > 0) {
                whereClause.category_id = catId;
            }
        }
        const products = await prisma.products.findMany({
            where: whereClause,
            include: { categories: { select: { name: true } } },
            orderBy: { created_at: "desc" },
        });
        res.status(200).json({
            success: true,
            products: products.map(({ categories, ...product }) => ({
                ...product,
                category_name: categories?.name || null,
            })),
        });
    }
    catch (error) {
        console.error("getProducts error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch products" });
    }
};
export const getMerchantProducts = async (req, res) => {
    try {
        const store = await getMerchantStore(req.user.id);
        if (!store) {
            res.status(404).json({
                success: false,
                message: "You must create a store before viewing products",
            });
            return;
        }
        const products = await prisma.products.findMany({
            where: { store_id: store.id },
            include: { categories: { select: { name: true } } },
            orderBy: { created_at: "desc" },
        });
        res.status(200).json({
            success: true,
            products: products.map(({ categories, ...product }) => ({
                ...product,
                category_name: categories?.name || null,
            })),
        });
    }
    catch (error) {
        console.error("getMerchantProducts error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch products" });
    }
};
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, compare_at_price, sku, stock = 0, category_id, images = [], variants = [], status = "active", } = req.body ?? {};
        const validationError = validateProductInput({ name, price, stock });
        if (validationError) {
            res.status(400).json({
                success: false,
                message: validationError,
            });
            return;
        }
        const store = await getMerchantStore(req.user.id);
        if (!store) {
            res.status(404).json({
                success: false,
                message: "You must create a store before adding products",
            });
            return;
        }
        if (category_id) {
            const category = await prisma.categories.findFirst({
                where: { id: Number(category_id), store_id: store.id },
            });
            if (!category) {
                res.status(404).json({
                    success: false,
                    message: "Category not found or access denied",
                });
                return;
            }
        }
        const product = await prisma.products.create({
            data: {
                store_id: store.id,
                category_id: category_id ? Number(category_id) : null,
                name: name.trim(),
                description: description || "",
                price: Number(price),
                compare_at_price: compare_at_price ? Number(compare_at_price) : null,
                sku: sku?.trim() || null,
                stock: Number(stock),
                images: Array.isArray(images) ? images : [],
                variants: Array.isArray(variants) ? variants : [],
                status: status || "active",
            },
        });
        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product,
        });
    }
    catch (error) {
        console.error("createProduct error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to create product" });
    }
};
export const updateProduct = async (req, res) => {
    try {
        const { name, description, price, compare_at_price, sku, stock, category_id, images, variants, status, } = req.body ?? {};
        const validationError = validateProductInput({ name, price, stock }, true);
        if (validationError) {
            res.status(400).json({ success: false, message: validationError });
            return;
        }
        const store = await getMerchantStore(req.user.id);
        if (!store) {
            res.status(404).json({ success: false, message: "Store not found" });
            return;
        }
        const { id } = req.params;
        const existing = await prisma.products.findFirst({
            where: { id: Number(id), store_id: store.id },
        });
        if (!existing) {
            res.status(404).json({
                success: false,
                message: "Product not found or access denied",
            });
            return;
        }
        if (category_id) {
            const category = await prisma.categories.findFirst({
                where: { id: Number(category_id), store_id: store.id },
            });
            if (!category) {
                res.status(400).json({
                    success: false,
                    message: "Category not found or access denied",
                });
                return;
            }
        }
        const updated = await prisma.products.update({
            where: { id: Number(id) },
            data: Object.fromEntries(Object.entries({
                name: name !== undefined ? name.trim() : undefined,
                description,
                price: price !== undefined ? Number(price) : undefined,
                sku,
                stock: stock !== undefined ? Number(stock) : undefined,
                compare_at_price: compare_at_price !== undefined
                    ? compare_at_price
                        ? Number(compare_at_price)
                        : null
                    : undefined,
                category_id: category_id !== undefined
                    ? category_id
                        ? Number(category_id)
                        : null
                    : undefined,
                images: images !== undefined
                    ? Array.isArray(images)
                        ? images
                        : []
                    : undefined,
                variants: variants !== undefined
                    ? Array.isArray(variants)
                        ? variants
                        : []
                    : undefined,
                status,
            }).filter(([, v]) => v !== undefined)),
        });
        res.json({
            success: true,
            message: "Product updated successfully",
            product: updated,
        });
    }
    catch (error) {
        console.error("updateProduct error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to update product" });
    }
};
export const deleteProduct = async (req, res) => {
    try {
        const store = await getMerchantStore(req.user.id);
        if (!store) {
            res.status(404).json({
                success: false,
                message: "You must create a store before adding products",
            });
            return;
        }
        const deleted = await prisma.products.deleteMany({
            where: { id: Number(req.params.id), store_id: store.id },
        });
        if (deleted.count === 0) {
            res.status(404).json({
                success: false,
                message: "Product not found or access denied",
            });
            return;
        }
        res.json({ success: true, message: "Product deleted successfully" });
    }
    catch (error) {
        console.error("deleteProduct error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to delete product" });
    }
};
