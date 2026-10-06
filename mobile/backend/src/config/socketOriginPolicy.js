// SMaRT-PDM: Realtime — socket Origin Policy (mobile backend config); configures shared mobile backend infrastructure.
function normalizeOrigin(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

// configuredOrigins: handles configured origins for the Realtime flow.
function configuredOrigins() {
    return new Set(
        String(
            process.env.MOBILE_SOCKET_ORIGINS ||
            process.env.FRONTEND_ORIGINS ||
            ''
        )
            .split(',')
            .map(normalizeOrigin)
            .filter(Boolean)
    );
}

// configuredSuffixes: handles configured suffixes for the Realtime flow.
function configuredSuffixes() {
    return [
        ...new Set([
            '.vercel.app',
            '.onrender.com',
            ...String(process.env.MOBILE_SOCKET_ORIGIN_SUFFIXES || '')
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean),
        ]),
    ];
}

// isPrivateIpv4: checks whether is private ipv4 for the Realtime flow.
function isPrivateIpv4(hostname) {
    const parts = String(hostname || '')
        .split('.')
        .map((part) => Number(part));

    if (
        parts.length !== 4 ||
        parts.some(
            (part) =>
                !Number.isInteger(part) ||
                part < 0 ||
                part > 255
        )
    ) {
        return false;
    }

    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (
        parts[0] === 172 &&
        parts[1] >= 16 &&
        parts[1] <= 31
    ) {
        return true;
    }

    return false;
}

// isAllowedSocketOrigin: checks whether is allowed socket origin for the Realtime flow.
function isAllowedSocketOrigin(origin) {
    if (!origin) return true;

    const normalized = normalizeOrigin(origin);

    if (configuredOrigins().has(normalized)) {
        return true;
    }

    try {
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.toLowerCase();

        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            return false;
        }

        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            isPrivateIpv4(hostname)
        ) {
            return true;
        }

        return configuredSuffixes().some(
            (suffix) => hostname.endsWith(suffix)
        );
    } catch (_) {
        return false;
    }
}

module.exports = {
    isAllowedSocketOrigin,
    isPrivateIpv4,
};
