const { listTransactionLog } = require("../shared/transactionLog");

// Reachable at /api/manageTransactionLogList (default folder-name routing).
// Protected by an explicit route rule in staticwebapp.config.json (requires
// the "administrator" role). Returns the most recent log entries, newest
// first.
module.exports = async function (context, req) {
    try {
        const entries = await listTransactionLog(200);
        context.res = { status: 200, body: entries };
    } catch (e) {
        context.log.error("Failed to list transaction log:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
