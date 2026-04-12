const { app } = require('@azure/functions');

app.http('verifyEmail', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Log to help us debug in the Azure Portal later
        context.log(`Http function processed request for url "${request.url}"`);

        const emailToVerify = request.query.get('email')?.toLowerCase().trim();
        const approvedListString = process.env.APPROVED_EMAILS || "";
        
        // Safety check: if no emails are configured, fail closed
        if (!approvedListString) {
            return { status: 500, body: "Server configuration missing." };
        }

        const approvedEmails = approvedListString.split(',').map(e => e.trim().toLowerCase());
        const isApproved = approvedEmails.includes(emailToVerify);

        return {
            status: 200,
            jsonBody: { isApproved: isApproved }
        };
    }
});
