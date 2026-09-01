const { getTripsTable, toTripDto, slugify, PARTITION_KEY } = require("../shared/tripsTable");

async function generateUniqueId(table, title) {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            await table.getEntity(PARTITION_KEY, candidate);
            suffix += 1;
            candidate = `${base}-${suffix}`;
        } catch (e) {
            const status = e.statusCode || (e.response && e.response.status);
            if (status === 404) return candidate;
            throw e;
        }
    }
}

// Reachable at /api/manageTripsSave (default folder-name routing). Named to
// avoid a literal "admin" prefix, since functions starting with "admin"
// were being silently excluded from this app's managed Functions build.
// Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role). Creates a trip if no id is given,
// otherwise updates the existing one in place.
module.exports = async function (context, req) {
    const body = req.body || {};
    const { id, title, address, lat, lon, date, heroHeadline, heroAccent, description, adultPrice, childPrice, capacity, spotsRemaining, image, hidden } = body;

    if (!title || !address || !date || !description) {
        context.res = { status: 400, body: "Missing required fields (title, address, date, description)." };
        return;
    }

    try {
        const table = getTripsTable();
        const rowKey = id || await generateUniqueId(table, title);

        const entity = {
            partitionKey: PARTITION_KEY,
            rowKey,
            title,
            address,
            date,
            heroHeadline: heroHeadline || "",
            heroAccent: heroAccent || "",
            description,
            adultPrice: Number(adultPrice) || 0,
            childPrice: Number(childPrice) || 0,
            capacity: Number(capacity) || 0,
            spotsRemaining: Number(spotsRemaining) || 0,
            image: image || "",
            hidden: !!hidden
        };
        if (lat != null && lat !== "") entity.lat = Number(lat);
        if (lon != null && lon !== "") entity.lon = Number(lon);

        await table.upsertEntity(entity, "Replace");
        context.res = { status: 200, body: toTripDto(entity) };
    } catch (e) {
        context.log.error("Failed to save trip:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
