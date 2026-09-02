const { getRegistrationsTable, toRegistrationDto } = require("../shared/registrationsTable");

module.exports = async function (context, req) {
    const emailToVerify = (req.query.email || (req.body && req.body.email))?.toLowerCase().trim();
    const tripId = req.query.tripId || (req.body && req.body.tripId);

    // Pull the list from your Azure App Settings
    const approvedListString = process.env.APPROVED_EMAILS || "";
    const approvedEmails = approvedListString.split(',').map(e => e.trim().toLowerCase());

    const isApproved = approvedEmails.includes(emailToVerify);

    let existingRegistration = null;
    if (isApproved && tripId) {
        try {
            const table = getRegistrationsTable();
            for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${tripId}'` } })) {
                if ((entity.email || "").toLowerCase() === emailToVerify) {
                    existingRegistration = toRegistrationDto(entity);
                    break;
                }
            }
        } catch (e) {
            context.log.error("Failed to check for an existing registration:", e);
            // Not fatal to email verification -- just proceed as if there's none.
        }
    }

    context.res = {
        status: 200,
        body: { isApproved, existingRegistration }
    };
}
