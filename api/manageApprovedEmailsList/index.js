const { listApprovedEmails } = require("../shared/approvedEmailsTable");

// Reachable at /api/manageApprovedEmailsList (default folder-name routing).
// Protected by an explicit route rule in staticwebapp.config.json (requires
// the "administrator" role).
module.exports = async function (context, req) {
    try {
        const emails = await listApprovedEmails();
        context.res = { status: 200, body: emails };
    } catch (e) {
        context.log.error("Failed to list approved emails:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
