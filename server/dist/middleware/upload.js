import multer from "multer";
import { ImageInputError, validateImageBuffer } from "../utils/imageValidation.js";
const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
const wrapMulterHandler = (handler) => (req, res, next) => {
    handler(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        next(error);
    });
};
export const upload = {
    single: (fieldName) => wrapMulterHandler(multerUpload.single(fieldName)),
    array: (fieldName, maxCount) => wrapMulterHandler(multerUpload.array(fieldName, maxCount)),
};
export const validateUploadedImages = async (req, res, next) => {
    const files = req.file ? [req.file] : (req.files || []);
    try {
        await Promise.all(files.map((file) => validateImageBuffer(file.buffer)));
        next();
    }
    catch (error) {
        if (error instanceof ImageInputError) {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        next(error);
    }
};
