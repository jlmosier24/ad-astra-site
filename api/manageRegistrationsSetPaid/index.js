const { getRegistrationsTable } = require("../shared/registrationsTable");

// Reachable at /api/manageRegistrationsSetPaid. Protected by an explicit
// route rule in staticwebapp.config.json (requires the "administrator"
// role). Toggles a single registration's paid flag.
module.exports = async function (context, req) {
    const { tripId, id, paid } = req.body || {};
    if (!tripId || !id) {
        context.res = { status: 400, body: "Missing tripId or id." };
        return;
    }

    try {
        const table = getRegistrationsTable();
        await table.updateEntity({ partitionKey: tripId, rowKey: id, paid: !!paid }, "Merge");
        context.res = { status: 200, body: "Updated" };
    } catch (e) {
        context.log.error("Failed to update registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
