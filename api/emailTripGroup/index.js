const { EmailClient } = require("@azure/communication-email");
const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable } = require("../shared/registrationsTable");
const { getClientPrincipalEmail } = require("../shared/transactionLog");

const SENDER_ADDRESS = "registration@adastraactive.com";
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Reachable at /api/emailTripGroup. Protected by an explicit route rule in
// staticwebapp.config.json (requires the "administrator" role). Sends a
// custom subject/body email to every unique registrant email for a trip,
// via BCC so families don't see each other's addresses.
module.exports = async function (context, req) {
    const { tripId, subject, body } = req.body || {};
    if (!tripId || !subject || !body) {
        context.res = { status: 400, body: "Missing tripId, subject, or body." };
        return;
    }

    let trip;
    try {
        const tripsTable = getTripsTable();
        trip = await tripsTable.getEntity(PARTITION_KEY, tripId);
    } catch (e) {
        trip = null;
    }
    if (!trip) {
        context.res = { status: 400, body: "Unknown trip." };
        return;
    }

    let recipientEmails;
    try {
        const registrationsTable = getRegistrationsTable();
        const emails = new Set();
        for await (const entity of registrationsTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${tripId}'` } })) {
            if (entity.email) emails.add(entity.email);
        }
        recipientEmails = [...emails];
    } catch (e) {
        context.log.error("Failed to load registrants:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
        return;
    }

    if (recipientEmails.length === 0) {
        context.res = { status: 400, body: "No registrants to email." };
        return;
    }

    // The "To" address is shown to every BCC'd recipient (and gets a copy),
    // so it's the sending admin's own address -- never a member's.
    const fromDisplayAddress = getClientPrincipalEmail(req) || SENDER_ADDRESS;

    const emailMessage = {
        senderAddress: SENDER_ADDRESS,
        content: {
            subject: `${trip.title}: ${subject}`,
            html: `
                <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #E7E3DD; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #1F2430; color: #FFFFFF; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Ad Astra Active</h1>
                    </div>
                    <div style="padding: 30px; color: #1F2430; line-height: 1.6;">
                        <h2 style="color: #7D2935; margin-top: 0; font-weight: 800;">${escapeHtml(subject)}</h2>
                        <p style="font-size: 0.9em; color: #5C6270; margin-top: -10px;">Regarding: ${escapeHtml(trip.title)}</p>
                        <p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>
                        <hr style="border: 0; border-top: 1px solid #EEEBE6; margin: 20px 0;">
                        <p style="font-size: 0.9em; color: #5C6270;">This is a message from your field trip coordinator. No reply is necessary.</p>
                    </div>
                    <div style="background-color: #F7F5F2; padding: 15px; text-align: center; font-size: 0.8em; color: #5C6270;">
                        Ad Astra Active · Fredericksburg, VA
                    </div>
                </div>
            `,
        },
        recipients: {
            to: [{ address: fromDisplayAddress }],
            bcc: recipientEmails.map(address => ({ address }))
        },
    };

    try {
        const poller = await client.beginSend(emailMessage);
        await poller.pollUntilDone();
        context.res = { status: 200, body: `Sent to ${recipientEmails.length} registrant${recipientEmails.length === 1 ? '' : 's'}.` };
    } catch (e) {
        context.log.error("Group email send failed:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
