const { getTripImagesContainer } = require("../shared/tripImagesContainer");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function sanitizeBaseName(filename) {
    const dot = filename.lastIndexOf(".");
    const base = (dot > 0 ? filename.slice(0, dot) : filename)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return base || "photo";
}

function extFromContentType(contentType) {
    const map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif"
    };
    return map[contentType] || "jpg";
}

// Protected by an explicit route rule in staticwebapp.config.json (requires
// the "administrator" role). Accepts { filename, contentType, dataBase64 }
// and stores the decoded image in the public "trip-images" blob container,
// returning its public URL for use as a trip's `image` field.
module.exports = async function (context, req) {
    const { filename, contentType, dataBase64 } = req.body || {};

    if (!contentType || !contentType.startsWith("image/")) {
        context.res = { status: 400, body: "File must be an image." };
        return;
    }
    if (!dataBase64) {
        context.res = { status: 400, body: "Missing image data." };
        return;
    }

    let buffer;
    try {
        buffer = Buffer.from(dataBase64, "base64");
    } catch (e) {
        context.res = { status: 400, body: "Could not decode image data." };
        return;
    }
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        context.res = { status: 400, body: `Image must be under ${MAX_BYTES / (1024 * 1024)}MB.` };
        return;
    }

    const base = sanitizeBaseName(filename || "photo");
    const ext = extFromContentType(contentType);
    const blobName = `${base}-${Date.now()}.${ext}`;

    try {
        const container = getTripImagesContainer();
        const blockBlobClient = container.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: contentType }
        });
        context.res = { status: 200, body: { url: blockBlobClient.url } };
    } catch (e) {
        context.log.error("Failed to upload image:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
