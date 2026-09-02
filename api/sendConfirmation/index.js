const { EmailClient } = require("@azure/communication-email");
const { getTripsTable, isPastTrip, PARTITION_KEY } = require("../shared/tripsTable");
const { getRegistrationsTable, getRegisteredCountsByTrip } = require("../shared/registrationsTable");

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
const client = new EmailClient(connectionString);

function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mirrors formatFullDate() in index.html so the email reads the same way
// the site does. The date components are fixed inputs, not "now", so this
// isn't subject to the server-vs-local timezone issue that affects
// same-day comparisons elsewhere.
function formatFullDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Mirrors directionsUrl() in index.html.
function directionsUrl(trip) {
    const query = trip.placeName ? `${trip.placeName}, ${trip.address}` : trip.address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildConfirmationHtml({ trip, parentName, adultCount, childCount, total }) {
    const dateLabel = trip.date ? formatFullDate(trip.date) : "";
    const locationLabel = trip.placeName ? `${trip.placeName} — ${trip.address}` : trip.address;
    const attendeeParts = [];
    if (adultCount > 0) attendeeParts.push(`${adultCount} adult${adultCount === 1 ? '' : 's'}`);
    if (childCount > 0) attendeeParts.push(`${childCount} child${childCount === 1 ? '' : 'ren'}`);
    const attendeeLabel = attendeeParts.join(" & ");

    const photoHtml = trip.image
        ? `<img src="${escapeHtml(trip.image)}" alt="${escapeHtml(trip.title)}" width="600" style="width: 100%; max-width: 600px; height: 220px; object-fit: cover; display: block;">`
        : "";

    const descriptionHtml = trip.description
        ? `<p style="margin: 20px 0 0;">${escapeHtml(trip.description)}</p>`
        : "";

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #38a169; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Ad Astra Active</h1>
            </div>
            ${photoHtml}
            <div style="padding: 30px; color: #2d3748; line-height: 1.6;">
                <h2 style="color: #2f855a; margin-top: 0;">Registration Confirmed!</h2>
                <p>Hi <strong>${escapeHtml(parentName)}</strong>, you're all set for:</p>
                <h3 style="margin: 0 0 16px; font-size: 20px; color: #1a202c;">${escapeHtml(trip.title)}</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                    <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7; color: #718096; width: 110px; vertical-align: top;">Date</td>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7;">${escapeHtml(dateLabel)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7; color: #718096; vertical-align: top;">Location</td>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7;">
                            ${escapeHtml(locationLabel)}<br>
                            <a href="${directionsUrl(trip)}" style="display: inline-block; margin-top: 6px; padding: 6px 14px; background-color: #38a169; color: white; text-decoration: none; border-radius: 999px; font-size: 0.85em;">Get Directions</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7; color: #718096; vertical-align: top;">Attendees</td>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7;">${escapeHtml(attendeeLabel)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7; color: #718096; vertical-align: top;">Total Due</td>
                        <td style="padding: 8px 0; border-top: 1px solid #edf2f7; font-weight: 700;">$${total.toFixed(2)}</td>
                    </tr>
                </table>
                ${descriptionHtml}
                <p style="margin-top: 20px;">We are excited to have you join us! More details on meeting time and what to bring will follow as we get closer to the date.</p>
                <p style="font-size: 0.9em; color: #718096;">Need to change your headcount or cancel? Click Register on this trip on the site again and enter this same email address to update or cancel your registration.</p>
                <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 20px 0;">
                <p style="font-size: 0.9em; color: #718096; margin-bottom: 0;">This is an automated confirmation. No reply is necessary.</p>
            </div>
            <div style="background-color: #f7fafc; padding: 15px; text-align: center; font-size: 0.8em; color: #a0aec0;">
                © 2026 Ad Astra Homeschool • Fredericksburg, VA
            </div>
        </div>
    `;
}

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
    if (isPastTrip(trip)) {
        context.res = { status: 400, body: "Registration for this trip has closed." };
        return;
    }

    const adultCount = parseInt(adults, 10) || 0;
    const childCount = parseInt(children, 10) || 0;
    if (!parentName || (adultCount <= 0 && childCount <= 0)) {
        context.res = { status: 400, body: "Please provide a parent name and at least one attendee." };
        return;
    }

    if (trip.capacity > 0) {
        let alreadyRegistered = 0;
        try {
            const counts = await getRegisteredCountsByTrip();
            alreadyRegistered = counts.get(trip.rowKey) || 0;
        } catch (e) {
            context.log.error("Failed to check capacity:", e);
            context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
            return;
        }
        const spotsLeft = Math.max(0, trip.capacity - alreadyRegistered);
        if (adultCount + childCount > spotsLeft) {
            context.res = { status: 400, body: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left for this trip.` };
            return;
        }
    }

    const total = (adultCount * trip.adultPrice) + (childCount * trip.childPrice);

    // Record the registration first -- this is the part that actually
    // matters for the roster. The confirmation email is best-effort on top.
    try {
        const registrationsTable = getRegistrationsTable();
        const registrationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await registrationsTable.createEntity({
            partitionKey: trip.rowKey,
            rowKey: registrationId,
            parentName,
            email: emailToCheck,
            adults: adultCount,
            children: childCount,
            total,
            paid: false,
            dateRegistered: new Date().toISOString()
        });
    } catch (e) {
        context.log.error("Failed to save registration:", e);
        context.res = { status: 500, body: "Error: " + (e.message || e.code || JSON.stringify(e)) };
        return;
    }

    const emailMessage = {
        senderAddress: "DoNotReply@3baad923-9af9-429b-9620-064e01fac201.azurecomm.net",
        content: {
            subject: `Registration Confirmed: ${trip.title}`,
            html: buildConfirmationHtml({ trip, parentName, adultCount, childCount, total }),
        },
        recipients: {
            to: [{ address: email }],
        },
    };

    try {
        const poller = await client.beginSend(emailMessage);
        await poller.pollUntilDone();
        context.res = { status: 200, body: `Success! Registration for ${trip.title} has been sent.` };
    } catch (e) {
        context.log.error("Email send failed:", e);
        // The registration itself is already saved -- let the parent know
        // it went through even though the confirmation email didn't.
        context.res = { status: 200, body: "Your registration was recorded, but the confirmation email couldn't be sent." };
    }
};
