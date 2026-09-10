const { TableClient } = require("@azure/data-tables");

const PARTITION_KEY = "authcode";
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function getAuthCodesTable() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    return TableClient.fromConnectionString(connectionString, "AuthCodes");
}

async function ensureTableExists(table) {
    try {
        await table.createTable();
    } catch (e) {
        if (e.statusCode !== 409) throw e;
    }
}

async function setAuthCode(email, code) {
    const table = getAuthCodesTable();
    await ensureTableExists(table);
    const now = new Date();
    await table.upsertEntity({
        partitionKey: PARTITION_KEY,
        rowKey: email,
        code,
        attempts: 0,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    }, "Replace");
}

async function getAuthCode(email) {
    const table = getAuthCodesTable();
    try {
        return await table.getEntity(PARTITION_KEY, email);
    } catch (e) {
        return null;
    }
}

async function incrementAttempts(email, entity) {
    const table = getAuthCodesTable();
    await table.updateEntity({
        partitionKey: PARTITION_KEY,
        rowKey: email,
        attempts: (entity.attempts || 0) + 1,
    }, "Merge");
}

async function deleteAuthCode(email) {
    const table = getAuthCodesTable();
    try {
        await table.deleteEntity(PARTITION_KEY, email);
    } catch (e) {
        // Already gone -- fine.
    }
}

module.exports = {
    getAuthCodesTable,
    setAuthCode,
    getAuthCode,
    incrementAttempts,
    deleteAuthCode,
    PARTITION_KEY,
    CODE_TTL_MINUTES,
    MAX_ATTEMPTS,
};
