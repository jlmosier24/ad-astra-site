const { buildClearCookie } = require("../shared/sessionAuth");

module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: { "Set-Cookie": buildClearCookie() },
        body: { message: "Signed out." },
    };
};
