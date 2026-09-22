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
// don't need a separate query per trip. Also builds a children-only count
// per trip in the same pass, for trips whose capacity only limits
// children (see registeredCountForCapacity). When an email is given, also
// collects which trips that email is registered for from this same pass
// -- piggybacking on the scan that already happens on every trips-list
// load, rather than running a second full-table scan just for that.
// Returns { counts, childCounts: Map<tripId, number>, myTripIds: Set<tripId> }.
async function getRegisteredCountsByTrip(email) {
    const table = getRegistrationsTable();
    const counts = new Map();
    const childCounts = new Map();
    const myTripIds = new Set();
    const normalizedEmail = (email || "").toLowerCase();
    for await (const entity of table.listEntities()) {
        const tripId = entity.partitionKey;
        const adults = entity.adults || 0;
        const children = entity.children || 0;
        counts.set(tripId, (counts.get(tripId) || 0) + adults + children);
        childCounts.set(tripId, (childCounts.get(tripId) || 0) + children);
        if (normalizedEmail && (entity.email || "").toLowerCase() === normalizedEmail) {
            myTripIds.add(tripId);
        }
    }
    return { counts, childCounts, myTripIds };
}

// Which of the two counts above applies against a trip's capacity. Works
// for both trip DTOs (.id) and raw Table Storage entities (.rowKey).
function registeredCountForCapacity(trip, counts, childCounts) {
    const map = trip.capacityScope === 'kids' ? childCounts : counts;
    return map.get(trip.id || trip.rowKey) || 0;
}

// How many of a given adult/child split count toward that same capacity.
function attendeesForCapacity(trip, adults, children) {
    return trip.capacityScope === 'kids' ? children : adults + children;
}

module.exports = {
    getRegistrationsTable, toRegistrationDto, getRegisteredCountsByTrip,
    registeredCountForCapacity, attendeesForCapacity
};
