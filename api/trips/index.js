const { getTripsTable, toTripDto, sortByDate, isPastTrip, PARTITION_KEY } = require("../shared/tripsTable");

module.exports = async function (context, req) {
    try {
        const table = getTripsTable();
        const trips = [];
        for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
            const dto = toTripDto(entity);
            if (!dto.hidden && !isPastTrip(dto)) trips.push(dto);
        }
        context.res = { status: 200, body: sortByDate(trips) };
    } catch (e) {
        context.log.error("Failed to list trips:", e);
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
