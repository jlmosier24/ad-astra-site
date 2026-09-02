const { TableClient } = require("@azure/data-tables");

const PARTITION_KEY = "approved";

function getApprovedEmailsTable() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    return TableClient.fromConnectionString(connectionString, "ApprovedEmails");
}

function toApprovedEmailDto(entity) {
    return {
        email: entity.rowKey,
        label: entity.label || "",
        dateAdded: entity.dateAdded || ""
    };
}

async function isApprovedEmail(email) {
    const normalized = (email || "").toLowerCase().trim();
    if (!normalized) return false;
    try {
        const table = getApprovedEmailsTable();
        await table.getEntity(PARTITION_KEY, normalized);
        return true;
    } catch (e) {
        return false;
    }
}

async function listApprovedEmails() {
    const table = getApprovedEmailsTable();
    const results = [];
    for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
        results.push(toApprovedEmailDto(entity));
    }
    return results.sort((a, b) => a.email.localeCompare(b.email));
}

module.exports = { getApprovedEmailsTable, toApprovedEmailDto, isApprovedEmail, listApprovedEmails, PARTITION_KEY };
