const { TableClient } = require("@azure/data-tables");
const { getApprovedEmailsTable, PARTITION_KEY: APPROVED_PARTITION_KEY } = require("./approvedEmailsTable");

const PARTITION_KEY = "request";
const TYPES = ["Change", "Bug", "Idea"];
const AREAS = ["Field Trips page", "Trip details & registration", "Admin tools", "Emails", "Something else"];
const STATUSES = ["submitted", "progress", "done", "declined"];
const OPEN_STATUSES = ["submitted", "progress"];

// Every admin signs in with the same "administrator" role, so the site owner
// -- the one person who can set a status or reply -- is told apart by email.
// REQUESTS_OWNER_EMAILS (comma-separated app setting) overrides the default.
const OWNER_EMAILS = (process.env.REQUESTS_OWNER_EMAILS || "jlmosier24@gmail.com")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

function isOwner(email) {
    return OWNER_EMAILS.includes((email || "").toLowerCase());
}

function getChangeRequestsTable() {
    return TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, "ChangeRequests");
}

function parseVotes(entity) {
    try {
        const votes = JSON.parse(entity.votesJson || "[]");
        return Array.isArray(votes) ? votes : [];
    } catch (e) {
        return [];
    }
}

// What the admin page sees. Emails stay server-side: the page only needs the
// submitter's name and whether the request / vote is the viewer's own.
function toChangeRequestDto(entity, viewerEmail) {
    const viewer = (viewerEmail || "").toLowerCase();
    const votes = parseVotes(entity);
    return {
        id: entity.rowKey,
        type: entity.type,
        area: entity.area,
        title: entity.title,
        details: entity.details,
        status: entity.status,
        reply: entity.reply || "",
        submitterName: entity.submitterName,
        isMine: (entity.submitterEmail || "").toLowerCase() === viewer,
        voteCount: votes.length,
        votedByMe: votes.includes(viewer),
        createdAt: entity.createdAt
    };
}

// The table doesn't exist until the first request is saved; until then a
// list is simply empty.
async function listChangeRequests() {
    const table = getChangeRequestsTable();
    const results = [];
    try {
        for await (const entity of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` } })) {
            results.push(entity);
        }
    } catch (e) {
        if (e.statusCode !== 404) throw e;
    }
    return results;
}

async function createChangeRequest(entity) {
    const table = getChangeRequestsTable();
    try {
        await table.createEntity(entity);
    } catch (e) {
        if (e.statusCode !== 404) throw e;
        await table.createTable();
        await table.createEntity(entity);
    }
}

// Uses the member list's name for this email when there is one, otherwise
// the part before the @ (the same thing the admin top bar shows).
async function displayNameFor(email) {
    try {
        const entity = await getApprovedEmailsTable().getEntity(APPROVED_PARTITION_KEY, email.toLowerCase());
        if (entity.label) return entity.label;
    } catch (e) {
        // Not on the member list -- fall through.
    }
    return email.split("@")[0];
}

module.exports = {
    PARTITION_KEY, TYPES, AREAS, STATUSES, OPEN_STATUSES, OWNER_EMAILS,
    isOwner, getChangeRequestsTable, parseVotes, toChangeRequestDto,
    listChangeRequests, createChangeRequest, displayNameFor
};
