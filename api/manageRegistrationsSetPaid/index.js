const { getRegistrationsTable } = require("../shared/registrationsTable");
const { getTripsTable, PARTITION_KEY: TRIP_PARTITION_KEY } = require("../shared/tripsTable");
const { logTransaction, getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRegistrationsSetPaid. Protected by an explicit
// route rule in staticwebapp.config.json (requires the "administrator"
// role). Toggles a single registration's paid flag.
module.exports = async function (context, req) {
    const { tripId, id, paid } = req.body || {};
    if (!tripId || !id) {
        context.res = { status: 400, body: "Missing tripId or id." };
        return;
    }

    try {
        const table = getRegistrationsTable();
        const desired = !!paid;
        await table.updateEntity({ partitionKey: tripId, rowKey: id, paid: desired }, "Merge");

        let parentName = "Registrant";
        let tripTitle = "trip";
        try {
            const reg = await table.getEntity(tripId, id);
            parentName = reg.parentName || parentName;
        } catch (e) { /* best-effort for the log summary only */ }
        try {
            const trip = await getTripsTable().getEntity(TRIP_PARTITION_KEY, tripId);
            tripTitle = trip.title || tripTitle;
        } catch (e) { /* best-effort for the log summary only */ }

        await logTransaction({
            action: desired ? "paid" : "unpaid",
            entityType: "Registration",
            summary: `${parentName}'s registration for "${tripTitle}" marked ${desired ? "paid" : "unpaid"}`,
            actor: getClientPrincipalEmail(req)
        });

        context.res = { status: 200, body: "Updated" };
    } catch (e) {
        context.log.error("Failed to update registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
