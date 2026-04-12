const { EmailClient } = require("@azure/communication-email");

// Get the connection string from your Azure Communication Service resource
const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

module.exports = async function (context, req) {
    const { email, parentName, tripTitle } = req.body;

    const emailMessage = {
        // MATCHING THE PORTAL CASING EXACTLY
        senderAddress: "DoNotReply@3baad923-9af9-429b-9620-064e01fac201.azurecomm.net",
        content: {
            subject: `Confirmed: ${tripTitle}`,
            plainText: `Hi ${parentName}, you're registered for the field trip!`,
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
        // UPDATED FOR DEBUGGING
        context.res = { status: 500, body: "Error: " + e.message };
    }
};
