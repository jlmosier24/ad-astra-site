const { getRegistrationsTable, toRegistrationDto } = require("../shared/registrationsTable");

// Reachable at /api/manageRegistrationsList (default folder-name routing --
// same naming rule as the trip-management functions applies here: no
// leading "admin"). Protected by an explicit route rule in
// staticwebapp.config.json (requires the "administrator" role). Returns
// every registration across every trip; the admin page groups them by trip.
module.exports = async function (context, req) {
    try {
        const table = getRegistrationsTable();
        const registrations = [];
        for await (const entity of table.listEntities()) {
            registrations.push(toRegistrationDto(entity));
        }
        registrations.sort((a, b) => (b.dateRegistered || "").localeCompare(a.dateRegistered || ""));
        context.res = { status: 200, body: registrations };
    } catch (e) {
        context.log.error("Failed to list registrations:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
