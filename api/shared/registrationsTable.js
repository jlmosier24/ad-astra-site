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

module.exports = { getRegistrationsTable, toRegistrationDto };
