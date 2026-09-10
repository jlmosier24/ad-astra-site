const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { getAuthCode, incrementAttempts, deleteAuthCode, MAX_ATTEMPTS } = require("../shared/authCodesTable");
const { createSessionToken, buildSessionCookie } = require("../shared/sessionAuth");

const SHORT_SESSION_SECONDS = 60 * 60 * 24; // 1 day
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 60; // 60 days

module.exports = async function (context, req) {
    const email = ((req.body && req.body.email) || "").toLowerCase().trim();
    const code = ((req.body && req.body.code) || "").trim();
    const remember = !!(req.body && req.body.remember);

    if (!email || !code) {
        context.res = { status: 400, body: { message: "Enter the code from your email." } };
        return;
    }

    if (!(await isApprovedEmail(email))) {
        context.res = { status: 403, body: { message: "We couldn't find that email on our member list." } };
        return;
    }

    const entity = await getAuthCode(email);
    if (!entity || new Date(entity.expiresAt).getTime() < Date.now()) {
        await deleteAuthCode(email);
        context.res = { status: 400, body: { message: "That code has expired. Request a new one." } };
        return;
    }

    if ((entity.attempts || 0) >= MAX_ATTEMPTS) {
        await deleteAuthCode(email);
        context.res = { status: 400, body: { message: "Too many attempts. Request a new code." } };
        return;
    }

    if (entity.code !== code) {
        await incrementAttempts(email, entity);
        context.res = { status: 400, body: { message: "That code doesn't match. Check your email and try again." } };
        return;
    }

    await deleteAuthCode(email);

    const maxAge = remember ? REMEMBER_SESSION_SECONDS : SHORT_SESSION_SECONDS;
    const token = createSessionToken(email, maxAge);

    context.res = {
        status: 200,
        headers: { "Set-Cookie": buildSessionCookie(token, maxAge) },
        body: { message: "Verified." },
    };
};
