const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");
const { logTransaction, getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageTripsDelete (default folder-name routing). Named
// to avoid a literal "admin" prefix, since functions starting with "admin"
// were being silently excluded from this app's managed Functions build.
// Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role).
module.exports = async function (context, req) {
    const id = req.query.id;
    if (!id) {
        context.res = { status: 400, body: "Missing trip id." };
        return;
    }

    try {
        const table = getTripsTable();
        let title = id;
        try {
            const trip = await table.getEntity(PARTITION_KEY, id);
            title = trip.title || id;
        } catch (e) {
            // Not fatal -- just falls back to the id in the log summary.
        }

        await table.deleteEntity(PARTITION_KEY, id);
        await logTransaction({
            action: "deleted",
            entityType: "Trip",
            summary: `"${title}" trip deleted`,
            actor: getClientPrincipalEmail(req)
        });
        context.res = { status: 200, body: "Deleted" };
    } catch (e) {
        context.log.error("Failed to delete trip:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
