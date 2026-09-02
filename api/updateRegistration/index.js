const { getTripsTable, isPastTrip, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable, getRegisteredCountsByTrip } = require("../shared/registrationsTable");
const { isApprovedEmail } = require("../shared/approvedEmailsTable");

// Public endpoint (no role gate) -- a parent can update their own
// registration by re-entering the same approved email in the trip's
// registration modal. Authorization: the submitted email must be on the
// approved list AND match the stored email on the registration being
// edited, so one family can't modify another's registration even if they
// somehow knew its id.
module.exports = async function (context, req) {
    const body = req.body || {};
    const { tripId, registrationId, parentName, adults, children, email } = body;

    if (!tripId || !registrationId) {
        context.res = { status: 400, body: "Missing tripId or registrationId." };
        return;
    }

    const emailToCheck = (email || "").toLowerCase().trim();
    if (!emailToCheck || !(await isApprovedEmail(emailToCheck))) {
        context.res = { status: 403, body: "This email is not on the authorized list." };
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
    if (isPastTrip(trip)) {
        context.res = { status: 400, body: "This trip has already happened, so registrations can no longer be changed." };
        return;
    }

    const registrationsTable = getRegistrationsTable();
    let existing;
    try {
        existing = await registrationsTable.getEntity(tripId, registrationId);
    } catch (e) {
        context.res = { status: 404, body: "Registration not found." };
        return;
    }
    if ((existing.email || "").toLowerCase() !== emailToCheck) {
        context.res = { status: 403, body: "This registration doesn't belong to that email." };
        return;
    }

    const adultCount = parseInt(adults, 10) || 0;
    const childCount = parseInt(children, 10) || 0;
    if (!parentName || (adultCount <= 0 && childCount <= 0)) {
        context.res = { status: 400, body: "Please provide a parent name and at least one attendee, or cancel the registration instead." };
        return;
    }

    if (trip.capacity > 0) {
        let totalRegistered = 0;
        try {
            const counts = await getRegisteredCountsByTrip();
            totalRegistered = counts.get(tripId) || 0;
        } catch (e) {
            context.log.error("Failed to check capacity:", e);
            context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
            return;
        }
        // Exclude this registration's own current attendees -- they aren't
        // competing against themselves for the remaining spots.
        const otherRegistered = totalRegistered - (existing.adults || 0) - (existing.children || 0);
        const spotsLeft = Math.max(0, trip.capacity - otherRegistered);
        if (adultCount + childCount > spotsLeft) {
            context.res = { status: 400, body: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left for this trip.` };
            return;
        }
    }

    const total = (adultCount * trip.adultPrice) + (childCount * trip.childPrice);

    try {
        await registrationsTable.updateEntity({
            partitionKey: tripId,
            rowKey: registrationId,
            parentName,
            adults: adultCount,
            children: childCount,
            total
        }, "Merge");
        context.res = { status: 200, body: `Your registration for ${trip.title} has been updated.` };
    } catch (e) {
        context.log.error("Failed to update registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
    }
};
