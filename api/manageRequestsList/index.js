const { isOwner, listChangeRequests, toChangeRequestDto } = require("../shared/changeRequestsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRequestsList. Protected by an explicit route rule
// in staticwebapp.config.json (requires the "administrator" role). Every
// admin sees every change request; isOwner tells the page whether to show
// the status and reply controls.
module.exports = async function (context, req) {
    const email = getClientPrincipalEmail(req);
    try {
        const entities = await listChangeRequests();
        context.res = {
            status: 200,
            body: { isOwner: isOwner(email), requests: entities.map(e => toChangeRequestDto(e, email)) }
        };
    } catch (e) {
        context.log.error("Failed to list change requests:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
