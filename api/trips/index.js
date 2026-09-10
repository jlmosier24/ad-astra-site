const { getTripsTable, toTripDto, withLiveSpotsRemaining, sortByDate, isPastTrip, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegisteredCountsByTrip } = require("../shared/registrationsTable");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { parseCookies, verifySessionToken, SESSION_COOKIE_NAME } = require("../shared/sessionAuth");

module.exports = async function (context, req) {
    const cookies = parseCookies(req);
    const email = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    if (!email || !(await isApprovedEmail(email))) {
        context.res = { status: 401, body: { message: "Sign in required." } };
        return;
    }

    try {
        const table = getTripsTable();
        const registeredCounts = await getRegisteredCountsByTrip();
        const trips = [];
        for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
            const dto = toTripDto(entity);
            if (!dto.hidden && !isPastTrip(dto)) {
                trips.push(withLiveSpotsRemaining(dto, registeredCounts.get(dto.id)));
            }
        }
        context.res = { status: 200, body: sortByDate(trips) };
    } catch (e) {
        context.log.error("Failed to list trips:", e);
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
