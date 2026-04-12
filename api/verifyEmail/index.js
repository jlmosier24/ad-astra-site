module.exports = async function (context, req) {
    const emailToVerify = (req.query.email || (req.body && req.body.email))?.toLowerCase().trim();
    
    // Pull the list from your Azure App Settings
    const approvedListString = process.env.APPROVED_EMAILS || "";
    const approvedEmails = approvedListString.split(',').map(e => e.trim().toLowerCase());

    const isApproved = approvedEmails.includes(emailToVerify);

    context.res = {
        status: 200,
        body: { isApproved: isApproved }
    };
}
