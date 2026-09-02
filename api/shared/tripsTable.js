const { TableClient } = require("@azure/data-tables");

const PARTITION_KEY = "trip";

function getTripsTable() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    return TableClient.fromConnectionString(connectionString, "Trips");
}

// Maps a Table Storage entity to the plain trip object the front-end expects.
function toTripDto(entity) {
    return {
        id: entity.rowKey,
        title: entity.title,
        address: entity.address,
        lat: entity.lat,
        lon: entity.lon,
        date: entity.date,
        heroHeadline: entity.heroHeadline || entity.title,
        heroAccent: entity.heroAccent || "",
        description: entity.description,
        adultPrice: entity.adultPrice,
        childPrice: entity.childPrice,
        capacity: entity.capacity,
        image: entity.image,
        hidden: !!entity.hidden
    };
}

// Attaches a live-computed spotsRemaining, based on actual registration
// counts rather than a manually-typed number. registeredCount is the total
// adults+children already signed up for this trip.
function withLiveSpotsRemaining(trip, registeredCount) {
    return {
        ...trip,
        spotsRemaining: trip.capacity > 0 ? Math.max(0, trip.capacity - (registeredCount || 0)) : 0
    };
}

// Sorts trip DTOs soonest-first. Dates are stored as "YYYY-MM-DD" strings,
// which sort correctly with plain string comparison.
function sortByDate(trips) {
    return trips.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

// Today's date as "YYYY-MM-DD", for comparing against trip.date strings.
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function isPastTrip(trip) {
    return !!trip.date && trip.date < todayIsoDate();
}

function slugify(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "trip";
}

module.exports = { getTripsTable, toTripDto, withLiveSpotsRemaining, sortByDate, todayIsoDate, isPastTrip, slugify, PARTITION_KEY };
