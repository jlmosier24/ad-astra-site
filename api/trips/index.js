const { getTripsTable, toTripDto, withLiveSpotsRemaining, sortByDate, isPastTrip, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegisteredCountsByTrip } = require("../shared/registrationsTable");

module.exports = async function (context, req) {
    try {
        const table = getTripsTable();
        const registeredCounts = await getRegisteredCountsByTrip();
        const trips = [];
        for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
            const dto = toTripDto(entity);
            if (!dto.hidden && !isPastTrip(dto)) {
                trips.push(withLiveSpotsRemaining(dto, registeredCounts.get(dto.id)));
            }
        }
        context.res = { status: 200, body: sortByDate(trips) };
    } catch (e) {
        context.log.error("Failed to list trips:", e);
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
