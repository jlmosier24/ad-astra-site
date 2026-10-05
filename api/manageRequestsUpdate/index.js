const { PARTITION_KEY, STATUSES, isOwner, getChangeRequestsTable, toChangeRequestDto } = require("../shared/changeRequestsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRequestsUpdate. Protected by an explicit route rule
// in staticwebapp.config.json (requires the "administrator" role), and
// further limited to the site owner: sets a request's status and/or reply.
module.exports = async function (context, req) {
    const email = getClientPrincipalEmail(req);
    if (!isOwner(email)) {
        context.res = { status: 403, body: "Only the site owner can update a request's status or reply." };
        return;
    }

    const body = req.body || {};
    if (!body.id) {
        context.res = { status: 400, body: "Missing request id." };
        return;
    }
    const changes = { partitionKey: PARTITION_KEY, rowKey: body.id, updatedAt: new Date().toISOString() };
    if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) {
            context.res = { status: 400, body: "Unknown status." };
            return;
        }
        changes.status = body.status;
    }
    if (body.reply !== undefined) {
        changes.reply = String(body.reply).trim().slice(0, 1000);
    }

    const table = getChangeRequestsTable();
    try {
        await table.updateEntity(changes, "Merge");
        const entity = await table.getEntity(PARTITION_KEY, body.id);
        context.res = { status: 200, body: toChangeRequestDto(entity, email) };
    } catch (e) {
        if (e.statusCode === 404) {
            context.res = { status: 404, body: "Request not found." };
            return;
        }
        context.log.error("Failed to update change request:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
