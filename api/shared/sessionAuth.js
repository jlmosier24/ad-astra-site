const crypto = require("crypto");

const SESSION_COOKIE_NAME = "ada_session";

function base64UrlEncode(input) {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input) {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
}

function sign(payload) {
    const secret = process.env.SESSION_SECRET;
    return crypto.createHmac("sha256", secret).update(payload).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createSessionToken(email, maxAgeSeconds) {
    const payload = base64UrlEncode(JSON.stringify({ email, exp: Date.now() + maxAgeSeconds * 1000 }));
    return `${payload}.${sign(payload)}`;
}

// Returns the email if the token is validly signed and not expired, otherwise null.
function verifySessionToken(token) {
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const { email, exp } = JSON.parse(base64UrlDecode(payload));
        if (!email || !exp || Date.now() > exp) return null;
        return email;
    } catch (e) {
        return null;
    }
}

function parseCookies(req) {
    const header = (req.headers && req.headers.cookie) || "";
    const cookies = {};
    header.split(";").forEach((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return;
        cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    });
    return cookies;
}

function buildSessionCookie(token, maxAgeSeconds) {
    return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function buildClearCookie() {
    return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

module.exports = {
    SESSION_COOKIE_NAME,
    createSessionToken,
    verifySessionToken,
    parseCookies,
    buildSessionCookie,
    buildClearCookie,
};
