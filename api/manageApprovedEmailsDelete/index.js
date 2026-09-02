const { getApprovedEmailsTable, PARTITION_KEY } = require("../shared/approvedEmailsTable");

// Reachable at /api/manageApprovedEmailsDelete (default folder-name
// routing). Protected by an explicit route rule in
// staticwebapp.config.json (requires the "administrator" role).
module.exports = async function (context, req) {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) {
        context.res = { status: 400, body: "Missing email." };
        return;
    }

    try {
        const table = getApprovedEmailsTable();
        await table.deleteEntity(PARTITION_KEY, email);
        context.res = { status: 200, body: "Deleted" };
    } catch (e) {
        context.log.error("Failed to delete approved email:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
