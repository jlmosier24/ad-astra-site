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
        location: entity.location,
        date: entity.date,
        heroHeadline: entity.heroHeadline || entity.title,
        heroAccent: entity.heroAccent || "",
        description: entity.description,
        adultPrice: entity.adultPrice,
        childPrice: entity.childPrice,
        capacity: entity.capacity,
        spotsRemaining: entity.spotsRemaining,
        image: entity.image,
        hidden: !!entity.hidden
    };
}

function slugify(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "trip";
}

module.exports = { getTripsTable, toTripDto, slugify, PARTITION_KEY };
