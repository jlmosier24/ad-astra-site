const { getTripsTable, toTripDto, slugify, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable } = require("../shared/registrationsTable");
const { logTransaction, getClientPrincipalEmail } = require("../shared/transactionLog");

async function tripIdExists(table, id) {
    try {
        await table.getEntity(PARTITION_KEY, id);
        return true;
    } catch (e) {
        const status = e.statusCode || (e.response && e.response.status);
        if (status === 404) return false;
        throw e;
    }
}

// Deleting a trip leaves its registrations behind (keyed by trip id), so an
// id can be free in the Trips table but still have last year's registrants
// attached. Reusing it would hand those to the new trip -- counting against
// its capacity and showing them as registered -- so treat it as taken.
async function hasRegistrations(id) {
    const iter = getRegistrationsTable().listEntities({ queryOptions: { filter: `PartitionKey eq '${id}'` } });
    const first = await iter.next();
    return !first.done;
}

async function generateUniqueId(table, title) {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;
    while (await tripIdExists(table, candidate) || await hasRegistrations(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
    return candidate;
}

// Reachable at /api/manageTripsSave (default folder-name routing). Named to
// avoid a literal "admin" prefix, since functions starting with "admin"
// were being silently excluded from this app's managed Functions build.
// Protected by an explicit route rule in staticwebapp.config.json
// (requires the "administrator" role). Creates a trip if no id is given,
// otherwise updates the existing one in place.
module.exports = async function (context, req) {
    const body = req.body || {};
    const { id, title, address, placeName, lat, lon, date, time, endTime, registrationDeadline, poc, description, adultPrice, childPrice, childAgeRange, capacity, capacityScope, image, hidden } = body;

    if (!title || !address || !date || !description) {
        context.res = { status: 400, body: "Missing required fields (title, address, date, description)." };
        return;
    }

    try {
        const table = getTripsTable();
        const isNew = !id;
        const rowKey = id || await generateUniqueId(table, title);

        const entity = {
            partitionKey: PARTITION_KEY,
            rowKey,
            title,
            address,
            placeName: placeName || "",
            date,
            time: time || "",
            endTime: endTime || "",
            registrationDeadline: registrationDeadline || "",
            poc: poc || "",
            description,
            adultPrice: Number(adultPrice) || 0,
            childPrice: Number(childPrice) || 0,
            childAgeRange: childAgeRange || "2-11",
            capacity: Number(capacity) || 0,
            capacityScope: capacityScope === "kids" ? "kids" : "everyone",
            image: image || "",
            hidden: !!hidden
        };
        if (lat != null && lat !== "") entity.lat = Number(lat);
        if (lon != null && lon !== "") entity.lon = Number(lon);

        await table.upsertEntity(entity, "Replace");
        if (isNew) {
            await logTransaction({
                action: "created",
                entityType: "Trip",
                summary: `"${title}" trip created`,
                actor: getClientPrincipalEmail(req)
            });
        }
        context.res = { status: 200, body: toTripDto(entity) };
    } catch (e) {
        context.log.error("Failed to save trip:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
