const { getRegistrationsTable, toRegistrationDto } = require("../shared/registrationsTable");
const { listApprovedEmails, preferMemberName } = require("../shared/approvedEmailsTable");

// Reachable at /api/manageRegistrationsList (default folder-name routing --
// same naming rule as the trip-management functions applies here: no
// leading "admin"). Protected by an explicit route rule in
// staticwebapp.config.json (requires the "administrator" role). Returns
// every registration across every trip; the admin page groups them by trip.
module.exports = async function (context, req) {
    try {
        const table = getRegistrationsTable();
        // Older registrations saved the email as the parent name; show the
        // Members tab name for those instead.
        let memberNames = new Map();
        try {
            memberNames = new Map((await listApprovedEmails()).map(a => [a.email, a.label]));
        } catch (e) {
            context.log.error("Failed to load member names:", e); // not fatal -- show stored names
        }
        const registrations = [];
        for await (const entity of table.listEntities()) {
            const dto = toRegistrationDto(entity);
            dto.parentName = preferMemberName(dto.parentName, dto.email, memberNames.get((dto.email || "").toLowerCase()));
            registrations.push(dto);
        }
        registrations.sort((a, b) => (b.dateRegistered || "").localeCompare(a.dateRegistered || ""));
        context.res = { status: 200, body: registrations };
    } catch (e) {
        context.log.error("Failed to list registrations:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
