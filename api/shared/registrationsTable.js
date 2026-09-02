const { TableClient } = require("@azure/data-tables");

function getRegistrationsTable() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    return TableClient.fromConnectionString(connectionString, "Registrations");
}

// PartitionKey is the trip id, RowKey is a unique registration id.
function toRegistrationDto(entity) {
    return {
        id: entity.rowKey,
        tripId: entity.partitionKey,
        parentName: entity.parentName,
        email: entity.email,
        adults: entity.adults,
        children: entity.children,
        total: entity.total,
        paid: !!entity.paid,
        dateRegistered: entity.dateRegistered
    };
}

// Scans every registration once and sums attendees per trip, so callers
// don't need a separate query per trip. Returns a Map<tripId, number>.
async function getRegisteredCountsByTrip() {
    const table = getRegistrationsTable();
    const counts = new Map();
    for await (const entity of table.listEntities()) {
        const tripId = entity.partitionKey;
        const attendees = (entity.adults || 0) + (entity.children || 0);
        counts.set(tripId, (counts.get(tripId) || 0) + attendees);
    }
    return counts;
}

module.exports = { getRegistrationsTable, toRegistrationDto, getRegisteredCountsByTrip };
