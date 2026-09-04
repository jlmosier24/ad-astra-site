const { getRegistrationsTable } = require("../shared/registrationsTable");
const { getTripsTable, PARTITION_KEY: TRIP_PARTITION_KEY } = require("../shared/tripsTable");
const { logTransaction, getClientPrincipalEmail } = require("../shared/transactionLog");

// Reachable at /api/manageRegistrationsDelete (default folder-name routing).
// Named to avoid a literal "admin" prefix, since functions starting with
// "admin" were being silently excluded from this app's managed Functions
// build. Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role). Lets the coordinator remove a
// registrant entirely -- e.g. a no-show or a duplicate -- freeing their
// spot in the live capacity count.
module.exports = async function (context, req) {
    const tripId = req.query.tripId;
    const id = req.query.id;
    if (!tripId || !id) {
        context.res = { status: 400, body: "Missing tripId or id." };
        return;
    }

    try {
        const table = getRegistrationsTable();
        let parentName = "Registrant";
        try {
            const reg = await table.getEntity(tripId, id);
            parentName = reg.parentName || parentName;
        } catch (e) { /* best-effort for the log summary only */ }
        let tripTitle = "trip";
        try {
            const trip = await getTripsTable().getEntity(TRIP_PARTITION_KEY, tripId);
            tripTitle = trip.title || tripTitle;
        } catch (e) { /* best-effort for the log summary only */ }

        await table.deleteEntity(tripId, id);
        await logTransaction({
            action: "deleted",
            entityType: "Registration",
            summary: `${parentName}'s registration for "${tripTitle}" deleted`,
            actor: getClientPrincipalEmail(req)
        });
        context.res = { status: 200, body: "Deleted" };
    } catch (e) {
        context.log.error("Failed to delete registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
