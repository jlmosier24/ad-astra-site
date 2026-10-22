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
        phone: entity.phone || "",
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

// The sign-up form has no name box, so a family's first registration saved
// their email as the parent name (and later ones copied it forward). A name
// that's blank or just the email is a placeholder: prefer the Name from the
// Members tab when one is set.
function isPlaceholderName(name, email) {
    const n = (name || "").trim().toLowerCase();
    return !n || n === (email || "").trim().toLowerCase();
}

function preferMemberName(name, email, memberName) {
    return isPlaceholderName(name, email) && memberName ? memberName : (name || email || "");
}

async function resolveParentName(name, email) {
    if (!isPlaceholderName(name, email)) return name;
    let memberName = "";
    try {
        const entity = await getApprovedEmailsTable().getEntity(PARTITION_KEY, (email || "").toLowerCase().trim());
        memberName = (entity.label || "").trim();
    } catch (e) { /* not a member, or lookup failed -- keep what we have */ }
    return preferMemberName(name, email, memberName);
}

async function listApprovedEmails() {
    const table = getApprovedEmailsTable();
    const results = [];
    for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
        results.push(toApprovedEmailDto(entity));
    }
    return results.sort((a, b) => a.email.localeCompare(b.email));
}

module.exports = {
    getApprovedEmailsTable, toApprovedEmailDto, isApprovedEmail, listApprovedEmails,
    preferMemberName, resolveParentName, PARTITION_KEY
};
