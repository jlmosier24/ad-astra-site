const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");

// Reachable at /api/manageTripsDelete (default folder-name routing). Named
// to avoid a literal "admin" prefix, since functions starting with "admin"
// were being silently excluded from this app's managed Functions build.
// Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role).
module.exports = async function (context, req) {
    const id = req.query.id;
    if (!id) {
        context.res = { status: 400, body: "Missing trip id." };
        return;
    }

    try {
        const table = getTripsTable();
        await table.deleteEntity(PARTITION_KEY, id);
        context.res = { status: 200, body: "Deleted" };
    } catch (e) {
        context.log.error("Failed to delete trip:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
