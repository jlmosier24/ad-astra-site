const { getTripsTable, toTripDto, PARTITION_KEY } = require("../shared/tripsTable");

// Reachable at /api/manageTripsList (default folder-name routing). Named to
// avoid a literal "admin" prefix, since functions starting with "admin"
// were being silently excluded from this app's managed Functions build --
// Azure Functions reserves the /admin/* namespace for its own host
// management API, and the build tooling appears to filter on that prefix.
// Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role) — returns every trip, hidden or not.
module.exports = async function (context, req) {
    try {
        const table = getTripsTable();
        const trips = [];
        for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
            trips.push(toTripDto(entity));
        }
        context.res = { status: 200, body: trips };
    } catch (e) {
        context.log.error("Failed to list trips:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
