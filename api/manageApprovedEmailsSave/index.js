const { getApprovedEmailsTable, toApprovedEmailDto, PARTITION_KEY } = require("../shared/approvedEmailsTable");

// Reachable at /api/manageApprovedEmailsSave (default folder-name routing).
// Protected by an explicit route rule in staticwebapp.config.json (requires
// the "administrator" role). Adds a new approved email, or updates the
// label on an existing one -- the email itself (the row key) can't be
// edited in place, only added or removed.
module.exports = async function (context, req) {
    const { email, label } = req.body || {};
    const normalized = (email || "").toLowerCase().trim();
    if (!normalized || !normalized.includes("@")) {
        context.res = { status: 400, body: "A valid email is required." };
        return;
    }

    try {
        const table = getApprovedEmailsTable();
        let dateAdded = new Date().toISOString();
        try {
            const existing = await table.getEntity(PARTITION_KEY, normalized);
            dateAdded = existing.dateAdded || dateAdded;
        } catch (e) {
            // No existing entry -- this is a new one, keep the fresh timestamp.
        }

        const entity = { partitionKey: PARTITION_KEY, rowKey: normalized, label: (label || "").trim(), dateAdded };
        await table.upsertEntity(entity, "Replace");
        context.res = { status: 200, body: toApprovedEmailDto(entity) };
    } catch (e) {
        context.log.error("Failed to save approved email:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
