const { TableClient } = require("@azure/data-tables");

const PARTITION_KEY = "log";

function getTransactionLogTable() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    return TableClient.fromConnectionString(connectionString, "TransactionLog");
}

function toLogDto(entity) {
    return {
        id: entity.rowKey,
        timestamp: entity.timestamp,
        action: entity.action,
        entityType: entity.entityType,
        summary: entity.summary,
        actor: entity.actor || ""
    };
}

// Extracts the signed-in admin's email from the Static Web Apps
// client-principal header, when present. Public endpoints (parent-
// initiated actions) pass the parent's own verified email as the actor
// instead, since there's no admin session on those routes.
function getClientPrincipalEmail(req) {
    const header = req.headers && (req.headers["x-ms-client-principal"] || req.headers["X-MS-CLIENT-PRINCIPAL"]);
    if (!header) return "";
    try {
        const decoded = Buffer.from(header, "base64").toString("utf8");
        const principal = JSON.parse(decoded);
        return principal.userDetails || "";
    } catch (e) {
        return "";
    }
}

// Best-effort logging -- a failure here should never block the write it's
// describing. Only creates, deletes, and payment-status changes are
// logged; routine edits (a trip's description, an attendee headcount)
// aren't, since the current state already shows those at a glance.
async function logTransaction({ action, entityType, summary, actor }) {
    try {
        const table = getTransactionLogTable();
        await table.createEntity({
            partitionKey: PARTITION_KEY,
            rowKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            action,
            entityType,
            summary,
            actor: actor || ""
        });
    } catch (e) {
        console.error("Failed to write transaction log entry:", e);
    }
}

async function listTransactionLog(limit) {
    const table = getTransactionLogTable();
    const entries = [];
    for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
        entries.push(toLogDto(entity));
    }
    entries.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    return typeof limit === "number" ? entries.slice(0, limit) : entries;
}

module.exports = { getTransactionLogTable, logTransaction, listTransactionLog, getClientPrincipalEmail, PARTITION_KEY };
