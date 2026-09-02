const { getRegistrationsTable } = require("../shared/registrationsTable");

// Reachable at /api/manageRegistrationsDelete (default folder-name routing).
// Named to avoid a literal "admin" prefix, since functions starting with
// "admin" were being silently excluded from this app's managed Functions
// build. Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role). Lets the coordinator remove a
// registrant entirely -- e.g. a no-show or a duplicate -- freeing their
// spot in the live capacity count.
module.exports = async function (context, req) {
    const tripId = req.query.tripId;
    const id = req.query.id;
    if (!tripId || !id) {
        context.res = { status: 400, body: "Missing tripId or id." };
        return;
    }

    try {
        const table = getRegistrationsTable();
        await table.deleteEntity(tripId, id);
        context.res = { status: 200, body: "Deleted" };
    } catch (e) {
        context.log.error("Failed to delete registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
