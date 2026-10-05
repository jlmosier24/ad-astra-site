const { PARTITION_KEY, OPEN_STATUSES, getChangeRequestsTable, parseVotes, toChangeRequestDto } = require("../shared/changeRequestsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRequestsVote. Protected by an explicit route rule
// in staticwebapp.config.json (requires the "administrator" role). Toggles
// the signed-in admin's "Me too" on someone else's open request.
module.exports = async function (context, req) {
    const email = (getClientPrincipalEmail(req) || "").toLowerCase();
    const id = req.body && req.body.id;
    if (!email) {
        context.res = { status: 401, body: "Sign in required." };
        return;
    }
    if (!id) {
        context.res = { status: 400, body: "Missing request id." };
        return;
    }

    const table = getChangeRequestsTable();
    // Votes live in one JSON field, so two admins voting at once could
    // overwrite each other. The ETag makes the second write fail instead;
    // it then re-reads and tries again.
    for (let attempt = 0; attempt < 3; attempt++) {
        let entity;
        try {
            entity = await table.getEntity(PARTITION_KEY, id);
        } catch (e) {
            context.res = { status: 404, body: "Request not found." };
            return;
        }
        if ((entity.submitterEmail || "").toLowerCase() === email) {
            context.res = { status: 400, body: "You can't add a Me too to your own request." };
            return;
        }
        if (!OPEN_STATUSES.includes(entity.status)) {
            context.res = { status: 400, body: "This request is already closed." };
            return;
        }

        const votes = parseVotes(entity);
        const next = votes.includes(email) ? votes.filter(v => v !== email) : [...votes, email];
        try {
            await table.updateEntity({ partitionKey: PARTITION_KEY, rowKey: id, votesJson: JSON.stringify(next) }, "Merge", { etag: entity.etag });
            context.res = { status: 200, body: toChangeRequestDto({ ...entity, votesJson: JSON.stringify(next) }, email) };
            return;
        } catch (e) {
            if (e.statusCode !== 412) {
                context.log.error("Failed to record vote:", e);
                context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
                return;
            }
        }
    }
    context.res = { status: 409, body: "Someone else just updated this request. Try again." };
};
