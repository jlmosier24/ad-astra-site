const { EmailClient } = require("@azure/communication-email");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { setAuthCode, getAuthCode } = require("../shared/authCodesTable");

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

const RESEND_COOLDOWN_MS = 30 * 1000;

function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function buildCodeEmailHtml(code) {
    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="padding: 30px; color: #2d3748; line-height: 1.6; text-align: center;">
                <h2 style="color: #2f4a3b; margin: 0 0 8px;">Ad Astra Active</h2>
                <p style="margin: 0 0 22px; color: #718096;">Here's your sign-in code:</p>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1a202c; margin-bottom: 22px;">${escapeHtml(code)}</div>
                <p style="font-size: 0.9em; color: #718096; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        </div>
    `;
}

module.exports = async function (context, req) {
    const email = ((req.body && req.body.email) || "").toLowerCase().trim();

    if (!email || !email.includes("@")) {
        context.res = { status: 400, body: { message: "Enter a valid email address." } };
        return;
    }

    if (!(await isApprovedEmail(email))) {
        context.res = { status: 403, body: { message: "We couldn't find that email on our member list." } };
        return;
    }

    try {
        const existing = await getAuthCode(email);
        if (existing && existing.createdAt && Date.now() - new Date(existing.createdAt).getTime() < RESEND_COOLDOWN_MS) {
            context.res = { status: 200, body: { message: "A code was just sent -- check your email." } };
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await setAuthCode(email, code);

        const emailMessage = {
            senderAddress: "registration@adastraactive.com",
            content: {
                subject: "Your Ad Astra Active sign-in code",
                html: buildCodeEmailHtml(code),
            },
            recipients: { to: [{ address: email }] },
        };
        const poller = await client.beginSend(emailMessage);
        await poller.pollUntilDone();

        context.res = { status: 200, body: { message: "Code sent." } };
    } catch (e) {
        context.log.error("Failed to send auth code:", e);
        context.res = { status: 500, body: { message: "Something went wrong sending the code. Try again." } };
    }
};
