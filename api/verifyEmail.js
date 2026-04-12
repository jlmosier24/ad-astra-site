const { app } = require('@azure/functions');

app.http('verifyEmail', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const emailToVerify = request.query.get('email')?.toLowerCase().trim();
        const approvedListString = process.env.APPROVED_EMAILS || "";
        const approvedEmails = approvedListString.split(',').map(e => e.trim().toLowerCase());

        return { jsonBody: { isApproved: approvedEmails.includes(emailToVerify) } };
    }
});
