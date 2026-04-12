const { EmailClient } = require("@azure/communication-email");

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

module.exports = async function (context, req) {
    const { parentName, adults, children, email, tripTitle } = req.body;

    const emailMessage = {
        senderAddress: "DoNotReply@3baad923-9af9-429b-9620-064e01fac201.azurecomm.net",
        content: {
            subject: `Registration Confirmed: ${tripTitle}`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #38a169; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">Ad Astra Explorers</h1>
                    </div>
                    <div style="padding: 30px; color: #2d3748; line-height: 1.6;">
                        <h2 style="color: #2f855a;">Registration Confirmed!</h2>
                        <p>Hi <strong>${parentName}</strong>,</p>
                        <p>Thank you for registering <strong>${adults}</strong> adults and <strong>${children}</strong> children for our upcoming field trip: <strong>${tripTitle}</strong>.</p>
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
