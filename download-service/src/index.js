const ALLOWED_ASSETS = new Set([
    'WinDirStat-arm.msi',
    'WinDirStat-arm64.msi',
    'WinDirStat-x64.msi',
    'WinDirStat-x86.msi',
    'WinDirStat.zip',
    'WinDirStat.7z',
    'WinDirStat-Hashes.txt',
    'WinDirStat_arm64.msix',
    'WinDirStat_x64.msix',
    'WinDirStat_x86.msix',
    'WinDirStat_x86_x64_arm64.msixbundle'
]);

const CDN_ORIGIN = 'https://release-assets.githubusercontent.com';
const DISPOSITION_PARAMETER = /([?&]response-content-disposition=)[^&]*/;
const FORWARDED_HEADERS = [
    'range',
    'if-range',
    'if-match',
    'if-none-match',
    'if-modified-since',
    'if-unmodified-since'
];

function errorResponse(message, status, headers) {
    return new Response(message, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/plain; charset=utf-8',
            ...headers
        }
    });
}

function parseDownload(pathname) {
    const path = /^\/downloads\/v(\d+\.\d+\.\d+)\/([^/]+)$/.exec(pathname);
    if (!path) {
        return null;
    }

    const [, version, requestedName] = path;
    const versionedPrefix = `WinDirStat-${version}`;
    const asset = requestedName.startsWith(versionedPrefix)
        ? `WinDirStat${requestedName.slice(versionedPrefix.length)}`
        : '';
    return ALLOWED_ASSETS.has(asset) ? { asset, requestedName, version } : null;
}

export async function handleRequest(request) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        return errorResponse('Method not allowed.', 405, { Allow: 'GET, HEAD' });
    }

    const download = parseDownload(new URL(request.url).pathname);
    if (!download) {
        return errorResponse('Download not found.', 404);
    }

    const { asset, requestedName, version } = download;
    const source = `https://github.com/windirstat/windirstat/releases/download/release/v${version}/${asset}`;
    let redirect;
    try {
        redirect = await fetch(source, { method: 'GET', redirect: 'manual' });
    } catch {
        return errorResponse('Download is temporarily unavailable.', 502);
    }

    if (redirect.status === 404) {
        return errorResponse('Download not found.', 404);
    }

    const location = redirect.headers.get('Location');
    let cdnUrl;
    try {
        cdnUrl = location ? new URL(location) : null;
    } catch {
        cdnUrl = null;
    }

    if (redirect.status >= 300 && redirect.status < 400 && cdnUrl?.origin === CDN_ORIGIN &&
        DISPOSITION_PARAMETER.test(location)) {
        const disposition = encodeURIComponent(`attachment; filename=${requestedName}`);
        const target = location.replace(DISPOSITION_PARAMETER, (_, prefix) => `${prefix}${disposition}`);
        return new Response(null, {
            status: 302,
            headers: {
                'Cache-Control': 'private, no-store',
                Location: target
            }
        });
    }

    const requestHeaders = new Headers({ Accept: 'application/octet-stream' });
    FORWARDED_HEADERS.forEach(name => {
        const value = request.headers.get(name);
        if (value) {
            requestHeaders.set(name, value);
        }
    });

    let response;
    try {
        response = await fetch(source, { method, headers: requestHeaders, redirect: 'follow' });
    } catch {
        return errorResponse('Download is temporarily unavailable.', 502);
    }

    if (response.status === 404) {
        return errorResponse('Download not found.', 404);
    }
    if (!response.ok && response.status !== 304 && response.status !== 416) {
        return errorResponse('Download is temporarily unavailable.', 502);
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Cache-Control', 'private, no-store');
    responseHeaders.delete('Set-Cookie');
    if (response.ok) {
        responseHeaders.set('Content-Disposition', `attachment; filename=${requestedName}`);
    }

    return new Response(method === 'HEAD' || response.status === 304 ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
    });
}

export default {
    fetch: handleRequest
};
