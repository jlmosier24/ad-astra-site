const { isApprovedEmail } = require("../shared/approvedEmailsTable");
const { parseCookies, verifySessionToken, SESSION_COOKIE_NAME } = require("../shared/sessionAuth");

module.exports = async function (context, req) {
    const cookies = parseCookies(req);
    const email = verifySessionToken(cookies[SESSION_COOKIE_NAME]);

    // Re-checking the approved list on every request (rather than trusting the
    // cookie alone) means removing someone from the list logs them out immediately.
    if (email && (await isApprovedEmail(email))) {
        context.res = { status: 200, body: { authenticated: true, email } };
        return;
    }

    context.res = { status: 200, body: { authenticated: false } };
};
