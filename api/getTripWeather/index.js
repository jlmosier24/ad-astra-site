// National Weather Service forecasts are US-only, need no API key, but do
// ask API consumers to identify themselves via User-Agent.
const NWS_USER_AGENT = "(ad-astra-active.azurestaticapps.net, jlmosier24@gmail.com)";

// In-memory cache, scoped to this Function instance's lifetime. Good enough
// for this site's traffic -- avoids hammering NWS on every page load
// without needing a separate persistent cache store. Resets on cold start.
const cache = new Map(); // "lat,lon" -> { fetchedAt, periods }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// NWS's daily forecast only reliably covers about a week out; trips
// further out than this get the "check back closer to the date" fallback
// instead of a guess.
const MAX_FORECAST_DAYS = 7;

function mapToIconKey(shortForecast, isDaytime) {
    const text = (shortForecast || "").toLowerCase();
    if (text.includes("snow") || text.includes("sleet") || text.includes("ice")) return "snow";
    if (text.includes("rain") || text.includes("shower") || text.includes("storm") || text.includes("thunder")) return "rain";
    if (text.includes("partly") || text.includes("mostly cloudy") || text.includes("mostly sunny") || text.includes("mostly clear")) return "partly-cloudy";
    if (text.includes("cloud") || text.includes("overcast") || text.includes("fog")) return "cloudy";
    return isDaytime ? "sunny" : "clear-night";
}

async function fetchForecastPeriods(lat, lon) {
    // NWS caps coordinate precision at 4 decimals and 301-redirects
    // otherwise; rounding up front avoids that extra round-trip.
    const roundedLat = lat.toFixed(4);
    const roundedLon = lon.toFixed(4);
    const cacheKey = `${roundedLat},${roundedLon}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        return cached.periods;
    }

    const headers = { "User-Agent": NWS_USER_AGENT };
    const pointsRes = await fetch(`https://api.weather.gov/points/${roundedLat},${roundedLon}`, { headers });
    if (!pointsRes.ok) throw new Error(`NWS points lookup failed: ${pointsRes.status}`);
    const pointsData = await pointsRes.json();
    const forecastUrl = pointsData.properties && pointsData.properties.forecast;
    if (!forecastUrl) throw new Error("NWS points response had no forecast URL");

    const forecastRes = await fetch(forecastUrl, { headers });
    if (!forecastRes.ok) throw new Error(`NWS forecast lookup failed: ${forecastRes.status}`);
    const forecastData = await forecastRes.json();
    const periods = (forecastData.properties && forecastData.properties.periods) || [];

    cache.set(cacheKey, { fetchedAt: Date.now(), periods });
    return periods;
}

// Public, anonymous -- just a read-through cache in front of a free
// government API, keyed on a trip's own coordinates and date.
module.exports = async function (context, req) {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const dateStr = req.query.date;

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !dateStr) {
        context.res = { status: 200, body: { available: false, reason: "missing-params" } };
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split('-').map(Number);
    const tripDate = new Date(y, m - 1, d);
    const daysOut = Math.round((tripDate - today) / (1000 * 60 * 60 * 24));

    if (daysOut < 0 || daysOut > MAX_FORECAST_DAYS) {
        context.res = { status: 200, body: { available: false, reason: "too-far-out" } };
        return;
    }

    try {
        const periods = await fetchForecastPeriods(lat, lon);
        const match = periods.find(p => p.isDaytime && (p.startTime || "").slice(0, 10) === dateStr);
        if (!match) {
            context.res = { status: 200, body: { available: false, reason: "no-data" } };
            return;
        }
        context.res = {
            status: 200,
            body: {
                available: true,
                temperature: match.temperature,
                temperatureUnit: match.temperatureUnit,
                shortForecast: match.shortForecast,
                iconKey: mapToIconKey(match.shortForecast, match.isDaytime)
            }
        };
    } catch (e) {
        context.log.error("Weather lookup failed:", e);
        context.res = { status: 200, body: { available: false, reason: "error" } };
    }
};
