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
// don't need a separate query per trip. When an email is given, also
// collects which trips that email is registered for from this same pass
// -- piggybacking on the scan that already happens on every trips-list
// load, rather than running a second full-table scan just for that.
// Returns { counts: Map<tripId, number>, myTripIds: Set<tripId> }.
async function getRegisteredCountsByTrip(email) {
    const table = getRegistrationsTable();
    const counts = new Map();
    const myTripIds = new Set();
    const normalizedEmail = (email || "").toLowerCase();
    for await (const entity of table.listEntities()) {
        const tripId = entity.partitionKey;
        const attendees = (entity.adults || 0) + (entity.children || 0);
        counts.set(tripId, (counts.get(tripId) || 0) + attendees);
        if (normalizedEmail && (entity.email || "").toLowerCase() === normalizedEmail) {
            myTripIds.add(tripId);
        }
    }
    return { counts, myTripIds };
}

module.exports = { getRegistrationsTable, toRegistrationDto, getRegisteredCountsByTrip };
