const { PARTITION_KEY, TYPES, AREAS, createChangeRequest, displayNameFor, toChangeRequestDto } = require("../shared/changeRequestsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRequestsSave. Protected by an explicit route rule
// in staticwebapp.config.json (requires the "administrator" role). Creates a
// new change request from the signed-in admin.
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

    try {
        const now = new Date().toISOString();
        const entity = {
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
        context.res = { status: 200, body: toChangeRequestDto(entity, email) };
    } catch (e) {
        context.log.error("Failed to save change request:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
