const { getRegistrationsTable, toRegistrationDto } = require("../shared/registrationsTable");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");

module.exports = async function (context, req) {
    const emailToVerify = (req.query.email || (req.body && req.body.email))?.toLowerCase().trim();
    const tripId = req.query.tripId || (req.body && req.body.tripId);

    const isApproved = await isApprovedEmail(emailToVerify);

    let existingRegistration = null;
    let suggestedName = null;
    if (isApproved) {
        try {
            const table = getRegistrationsTable();
            let mostRecent = null;
            // Scans every trip's registrations (not just this one) so a parent's
            // name can be suggested even on a trip they've never registered for.
            for await (const entity of table.listEntities()) {
                if ((entity.email || "").toLowerCase() !== emailToVerify) continue;
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
            // Not fatal to email verification -- just proceed as if there's none.
        }
    }

    context.res = {
        status: 200,
        body: { isApproved, existingRegistration, suggestedName }
    };
}
