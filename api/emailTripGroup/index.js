const { EmailClient } = require("@azure/communication-email");
const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable } = require("../shared/registrationsTable");

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

    const approvedEmails = (process.env.APPROVED_EMAILS || "").split(',').map(e => e.trim()).filter(Boolean);
    const fromDisplayAddress = approvedEmails[0] || recipientEmails[0];

    const emailMessage = {
        senderAddress: "DoNotReply@3baad923-9af9-429b-9620-064e01fac201.azurecomm.net",
        content: {
            subject: `${trip.title}: ${subject}`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #38a169; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">Ad Astra Explorers</h1>
                    </div>
                    <div style="padding: 30px; color: #2d3748; line-height: 1.6;">
                        <h2 style="color: #2f855a; margin-top: 0;">${escapeHtml(subject)}</h2>
                        <p style="font-size: 0.9em; color: #718096; margin-top: -10px;">Regarding: ${escapeHtml(trip.title)}</p>
                        <p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>
                        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;">
                        <p style="font-size: 0.9em; color: #718096;">This is a message from your field trip coordinator. No reply is necessary.</p>
                    </div>
                    <div style="background-color: #f7fafc; padding: 15px; text-align: center; font-size: 0.8em; color: #a0aec0;">
                        © 2026 Ad Astra Homeschool • Fredericksburg, VA
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
