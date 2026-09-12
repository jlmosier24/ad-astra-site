const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable } = require("../shared/registrationsTable");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { logTransaction } = require("../shared/transactionLog");
const { parseCookies, verifySessionToken, SESSION_COOKIE_NAME } = require("../shared/sessionAuth");

// Public endpoint (no role gate) -- a signed-in parent can cancel their own
// registration. Same authorization as updateRegistration: the caller's
// session email must match the submitted email, that email must be
// approved, AND it must match the stored email on the registration being
// cancelled.
module.exports = async function (context, req) {
    const body = req.body || {};
    const { tripId, registrationId, email } = body;

    if (!tripId || !registrationId) {
        context.res = { status: 400, body: "Missing tripId or registrationId." };
        return;
    }

    const emailToCheck = (email || "").toLowerCase().trim();
    if (!emailToCheck || !(await isApprovedEmail(emailToCheck))) {
        context.res = { status: 403, body: "This email is not on the authorized list." };
        return;
    }

    const cookies = parseCookies(req);
    const sessionEmail = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    if (!sessionEmail || sessionEmail !== emailToCheck) {
        context.res = { status: 401, body: "Sign in required." };
        return;
    }

    const registrationsTable = getRegistrationsTable();
    let existing;
    try {
        existing = await registrationsTable.getEntity(tripId, registrationId);
    } catch (e) {
        context.res = { status: 404, body: "Registration not found." };
        return;
    }
    if ((existing.email || "").toLowerCase() !== emailToCheck) {
        context.res = { status: 403, body: "This registration doesn't belong to that email." };
        return;
    }

    let tripTitle = "this trip";
    try {
        const tripsTable = getTripsTable();
        const trip = await tripsTable.getEntity(PARTITION_KEY, tripId);
        tripTitle = trip.title || tripTitle;
    } catch (e) {
        // Not fatal -- the cancellation itself doesn't depend on the trip
        // still existing, this is just for a friendlier message.
    }

    try {
        await registrationsTable.deleteEntity(tripId, registrationId);
        await logTransaction({
            action: "deleted",
            entityType: "Registration",
            summary: `${existing.parentName || "Registrant"}'s registration for "${tripTitle}" cancelled`,
            actor: emailToCheck
        });
        context.res = { status: 200, body: `Your registration for ${tripTitle} has been cancelled.` };
    } catch (e) {
        context.log.error("Failed to cancel registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
