const { getRegistrationsTable, toRegistrationDto } = require("../shared/registrationsTable");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { parseCookies, verifySessionToken, SESSION_COOKIE_NAME } = require("../shared/sessionAuth");

// Looks up the signed-in member's own registration for a trip (and a name to
// pre-fill). The email always comes from the session cookie, never the
// request -- otherwise anyone could look up any family's registration.
module.exports = async function (context, req) {
    const cookies = parseCookies(req);
    const email = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    if (!email || !(await isApprovedEmail(email))) {
        context.res = { status: 401, body: { message: "Sign in required." } };
        return;
    }

    const tripId = req.query.tripId || (req.body && req.body.tripId);

    let existingRegistration = null;
    let suggestedName = null;
    try {
        const table = getRegistrationsTable();
        let mostRecent = null;
        // Scans every trip's registrations (not just this one) so a parent's
        // name can be suggested even on a trip they've never registered for.
        for await (const entity of table.listEntities()) {
            if ((entity.email || "").toLowerCase() !== email) continue;
            if (tripId && entity.partitionKey === tripId) {
                existingRegistration = toRegistrationDto(entity);
            }
            if (!mostRecent || (entity.dateRegistered || "") > (mostRecent.dateRegistered || "")) {
                mostRecent = entity;
            }
        }
        if (mostRecent) suggestedName = mostRecent.parentName || null;
    } catch (e) {
        context.log.error("Failed to check for an existing registration:", e);
        // Not fatal -- just proceed as if there's none.
    }

    context.res = {
        status: 200,
        body: { isApproved: true, existingRegistration, suggestedName }
    };
};
