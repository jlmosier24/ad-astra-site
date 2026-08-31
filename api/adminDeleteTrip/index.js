const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");

// Protected by the "admin/trips/{id}" route rule in staticwebapp.config.json
// (requires the "administrator" role).
module.exports = async function (context, req) {
    const id = context.bindingData.id;
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
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
