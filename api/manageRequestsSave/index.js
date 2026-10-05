const { EmailClient } = require("@azure/communication-email");
const { PARTITION_KEY, TYPES, AREAS, OWNER_EMAILS, isOwner, createChangeRequest, displayNameFor, toChangeRequestDto } = require("../shared/changeRequestsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

const SENDER_ADDRESS = "registration@adastraactive.com";
const TYPE_LABELS = { Change: "Change something", Bug: "Something's broken", Idea: "New idea" };
const client = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);

function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function buildNotificationHtml(entity) {
    return `
        <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #E7E3DD; border-radius: 12px; overflow: hidden;">
            <div style="padding: 28px 30px; color: #1F2430; line-height: 1.6;">
                <p style="margin: 0 0 4px; font-size: 0.8em; font-weight: 700; color: #7D2935; text-transform: uppercase; letter-spacing: 0.05em;">New site request</p>
                <h2 style="margin: 0 0 6px; font-weight: 800; color: #1F2430;">${escapeHtml(entity.title)}</h2>
                <p style="margin: 0 0 18px; color: #5C6270; font-size: 0.9em;">${escapeHtml(entity.submitterName)} &middot; ${escapeHtml(TYPE_LABELS[entity.type] || entity.type)} &middot; ${escapeHtml(entity.area)}</p>
                <p style="margin: 0 0 22px; white-space: pre-wrap;">${escapeHtml(entity.details)}</p>
                <a href="https://adastraactive.com/admin.html" style="display: inline-block; padding: 9px 18px; background-color: #1F2430; color: #FFFFFF; text-decoration: none; border-radius: 999px; font-size: 0.9em; font-weight: 700;">Open the Requests tab</a>
            </div>
            <div style="background-color: #F7F5F2; padding: 15px; text-align: center; font-size: 0.8em; color: #5C6270;">
                Ad Astra Active · Fredericksburg, VA
            </div>
        </div>
    `;
}

// Best-effort: the request is already saved, so a failed email is only logged.
async function notifyOwner(context, entity) {
    try {
        const poller = await client.beginSend({
            senderAddress: SENDER_ADDRESS,
            content: {
                subject: `New site request: ${entity.title}`,
                html: buildNotificationHtml(entity),
            },
            recipients: { to: OWNER_EMAILS.map(address => ({ address })) },
        });
        poller.pollUntilDone().catch((e) => context.log.error("Request notification email failed after queuing:", e));
    } catch (e) {
        context.log.error("Failed to send request notification email:", e);
    }
}

// Reachable at /api/manageRequestsSave. Protected by an explicit route rule
// in staticwebapp.config.json (requires the "administrator" role). Creates a
// new change request from the signed-in admin and emails the site owner.
module.exports = async function (context, req) {
    const email = getClientPrincipalEmail(req);
    if (!email) {
        context.res = { status: 401, body: "Sign in required." };
        return;
    }

    const body = req.body || {};
    const type = TYPES.includes(body.type) ? body.type : "Change";
    const area = AREAS.includes(body.area) ? body.area : "Something else";
    const title = String(body.title || "").trim().slice(0, 120);
    const details = String(body.details || "").trim().slice(0, 2000);
    if (!title || !details) {
        context.res = { status: 400, body: "Add a short summary and some details." };
        return;
    }

    let entity;
    try {
        const now = new Date().toISOString();
        entity = {
            partitionKey: PARTITION_KEY,
            rowKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            area,
            title,
            details,
            status: "submitted",
            reply: "",
            submitterEmail: email.toLowerCase(),
            submitterName: await displayNameFor(email),
            votesJson: "[]",
            createdAt: now,
            updatedAt: now
        };
        await createChangeRequest(entity);
    } catch (e) {
        context.log.error("Failed to save change request:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
        return;
    }

    // No need to email the owner about their own request.
    if (!isOwner(email)) await notifyOwner(context, entity);

    context.res = { status: 200, body: toChangeRequestDto(entity, email) };
};
