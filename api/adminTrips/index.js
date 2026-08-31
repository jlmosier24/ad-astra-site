const { getTripsTable, toTripDto, PARTITION_KEY } = require("../shared/tripsTable");

// Protected by the "admin/trips" route rule in staticwebapp.config.json
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
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
