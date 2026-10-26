import { fileTypeFromBuffer } from "file-type";

export class ImageInputError extends Error {}

// Keep external sources limited to the CDN used by the default model image.
const externalImageHosts = new Set(["images.unsplash.com"]);

export function validateImageUrl(value: unknown, cloudName?: string): URL {
  if (typeof value !== "string") {
    throw new ImageInputError("A valid HTTPS image URL is required");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageInputError("A valid HTTPS image URL is required");
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.port ||
    !(isOwnedCloudinaryUrl(url, cloudName) || externalImageHosts.has(url.hostname))
  ) {
    throw new ImageInputError("Image URL host or protocol is not allowed");
  }
  return url;
}

export function isOwnedCloudinaryUrl(url: URL, cloudName?: string): boolean {
  return Boolean(
    cloudName && url.hostname === "res.cloudinary.com" &&
    url.pathname.startsWith(`/${cloudName}/image/upload/`),
  );
}

const supportedImageTypes = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
]);

export function isSvgBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length === 0) return false;

  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  text = text.trim();
  if (!text) return false;

  if (!/<svg[\s>]/i.test(text)) return false;

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

export async function validateImageBuffer(buffer: Buffer): Promise<void> {
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

export function normalizeColor(value: unknown): string {
  if (value === undefined || value === null || value === "") return "red";
  if (typeof value === "string") {
    const color = value.toLowerCase();
    if (/^#?(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/.test(color)) {
      return color.replace(/^#/, "");
    }
    if (namedColors.has(color)) return color;
  }
  throw new ImageInputError("toColor must be a valid hex or named color");
}
