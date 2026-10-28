import { fileTypeFromBuffer } from "file-type";
export class ImageInputError extends Error {
}
function isPrivateHost(hostname) {
    const lower = hostname.toLowerCase();
    if (lower === "localhost" ||
        lower.endsWith(".local") ||
        lower.endsWith(".internal") ||
        lower.endsWith(".lan") ||
        lower === "127.0.0.1" ||
        lower === "::1" ||
        lower === "0.0.0.0") {
        return true;
    }
    const ipMatch = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const parts = [Number(ipMatch[1]), Number(ipMatch[2]), Number(ipMatch[3]), Number(ipMatch[4])];
        if (parts.some((p) => p < 0 || p > 255))
            return true;
        const [a, b] = parts;
        if (a === 127)
            return true;
        if (a === 10)
            return true;
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 169 && b === 254)
            return true;
        if (a === 0)
            return true;
    }
    return false;
}
export function validateImageUrl(value, cloudName) {
    if (typeof value !== "string" || !value.trim()) {
        throw new ImageInputError("A valid HTTPS image URL is required");
    }
    let url;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new ImageInputError("A valid HTTPS image URL is required");
    }
    if (url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        isPrivateHost(url.hostname)) {
        throw new ImageInputError("Image URL host or protocol is not allowed");
    }
    return url;
}
export function isCloudinaryUrl(url) {
    return (url.hostname === "res.cloudinary.com" ||
        url.hostname.endsWith(".cloudinary.com"));
}
export function isOwnedCloudinaryUrl(url, cloudName) {
    return Boolean(cloudName && url.hostname === "res.cloudinary.com" &&
        url.pathname.startsWith(`/${cloudName}/image/upload/`));
}
const supportedImageTypes = new Set([
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
]);
export function isSvgBuffer(buffer) {
    if (!buffer || buffer.length === 0)
        return false;
    let text = buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }
    text = text.trim();
    if (!text)
        return false;
    if (!/<svg[\s>]/i.test(text))
        return false;
    // Strip XML comments
    const stripped = text.replace(/<!--[\s\S]*?-->/g, "").trim();
    // Strip XML declaration (e.g. <?xml ... ?>)
    const withoutXmlDecl = stripped.replace(/^<\?xml[^>]*\?>/i, "").trim();
    // Reject XXE / entity declarations
    if (/<!ENTITY/i.test(withoutXmlDecl)) {
        return false;
    }
    // Strip DOCTYPE if present (must be DOCTYPE svg)
    let rootContent = withoutXmlDecl;
    if (/^<!DOCTYPE[\s\S]*?>/i.test(rootContent)) {
        if (!/^<!DOCTYPE\s+svg[\s\S]*?>/i.test(rootContent)) {
            return false;
        }
        rootContent = rootContent.replace(/^<!DOCTYPE[\s\S]*?>/i, "").trim();
    }
    // Root element must start with <svg ...
    if (!/^<svg[\s>]/i.test(rootContent)) {
        return false;
    }
    // Must have a closing </svg> or be self-closing <svg ... />
    if (!/<\/svg\s*>$|\/>\s*$/i.test(rootContent)) {
        return false;
    }
    // Security: check for embedded scripts, event handlers, and dangerous tags/protocols
    const dangerousPatterns = [
        /<script[\s>]/i,
        /<\/script>/i,
        /\bon[a-z]+\s*=/i,
        /javascript\s*:/i,
        /data\s*:\s*text\/html/i,
        /<foreignObject[\s>]/i,
        /<iframe[\s>]/i,
        /<embed[\s>]/i,
        /<object[\s>]/i,
        /<meta[\s>]/i,
        /<link[\s>]/i,
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(rootContent)) {
            return false;
        }
    }
    return true;
}
export async function validateImageBuffer(buffer) {
    const detected = await fileTypeFromBuffer(buffer).catch(() => undefined);
    if (detected && supportedImageTypes.has(detected.mime)) {
        return;
    }
    if (isSvgBuffer(buffer)) {
        return;
    }
    throw new ImageInputError("Only JPEG, PNG, GIF, WebP, AVIF, and SVG images are supported");
}
const namedColors = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral
  cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen
  darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon
  darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink
  deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo
  ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.split(/\s+/));
export function normalizeColor(value) {
    if (value === undefined || value === null || value === "")
        return "red";
    if (typeof value === "string") {
        const color = value.toLowerCase();
        if (/^#?(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(color)) {
            return color.replace(/^#/, "");
        }
        if (namedColors.has(color))
            return color;
    }
    throw new ImageInputError("toColor must be a valid hex or named color");
}
