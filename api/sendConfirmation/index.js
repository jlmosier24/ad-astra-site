const { EmailClient } = require("@azure/communication-email");
const { getTripsTable, PARTITION_KEY } = require("../shared/tripsTable");

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

module.exports = async function (context, req) {
    const body = req.body || {};
    const { parentName, adults, children, email, tripId, tripTitle } = body;

    const emailToCheck = (email || "").toLowerCase().trim();
    const approvedEmails = (process.env.APPROVED_EMAILS || "").split(',').map(e => e.trim().toLowerCase());
    if (!emailToCheck || !approvedEmails.includes(emailToCheck)) {
        context.res = { status: 403, body: "This email is not on the authorized list." };
        return;
    }

    let trip;
    try {
        const table = getTripsTable();
        if (tripId) {
            trip = await table.getEntity(PARTITION_KEY, tripId);
        } else {
            // Fallback for older clients that only send a title.
            for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
                if (entity.title === tripTitle) { trip = entity; break; }
            }
        }
    } catch (e) {
        trip = null;
    }
    if (!trip) {
        context.res = { status: 400, body: "Unknown trip." };
        return;
    }

    const adultCount = parseInt(adults, 10) || 0;
    const childCount = parseInt(children, 10) || 0;
    if (!parentName || (adultCount <= 0 && childCount <= 0)) {
        context.res = { status: 400, body: "Please provide a parent name and at least one attendee." };
        return;
    }

    const total = (adultCount * trip.adultPrice) + (childCount * trip.childPrice);

    const emailMessage = {
        senderAddress: "DoNotReply@3baad923-9af9-429b-9620-064e01fac201.azurecomm.net",
        content: {
            subject: `Registration Confirmed: ${trip.title}`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #38a169; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">Ad Astra Explorers</h1>
                    </div>
                    <div style="padding: 30px; color: #2d3748; line-height: 1.6;">
                        <h2 style="color: #2f855a;">Registration Confirmed!</h2>
                        <p>Hi <strong>${parentName}</strong>,</p>
                        <p>Thank you for registering <strong>${adultCount}</strong> adults and <strong>${childCount}</strong> children for our upcoming field trip: <strong>${trip.title}</strong>.</p>
                        <p>Total due: <strong>$${total.toFixed(2)}</strong></p>
                        <p>We are excited to have you join us! You will receive more details regarding the meeting location and schedule as we get closer to the date.</p>
                        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;">
                        <p style="font-size: 0.9em; color: #718096;">This is an automated confirmation. No reply is necessary.</p>
                    </div>
                    <div style="background-color: #f7fafc; padding: 15px; text-align: center; font-size: 0.8em; color: #a0aec0;">
                        © 2026 Ad Astra Homeschool • Fredericksburg, VA
                    </div>
                </div>
            `,
        },
        recipients: {
            to: [{ address: email }],
        },
    };

    try {
        const poller = await client.beginSend(emailMessage);
        await poller.pollUntilDone();
        context.res = { status: 200, body: "Success" };
    } catch (e) {
        context.log.error("Email send failed:", e);
        // Keep the detailed error for now just in case deployment gets tricky again
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
