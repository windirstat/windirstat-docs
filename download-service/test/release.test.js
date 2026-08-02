import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { handleRequest } from '../src/index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const aliases = new Map([
    ['WinDirStat-2.7.0-arm64.msi', 'WinDirStat-arm64.msi'],
    ['WinDirStat-2.7.0-x64.msi', 'WinDirStat-x64.msi'],
    ['WinDirStat-2.7.0-x86.msi', 'WinDirStat-x86.msi'],
    ['WinDirStat-2.7.0.zip', 'WinDirStat.zip'],
    ['WinDirStat-2.7.0.7z', 'WinDirStat.7z'],
    ['WinDirStat-2.7.0-Hashes.txt', 'WinDirStat-Hashes.txt']
]);

function request(filename, method = 'GET', headers) {
    return new Request(`https://windirstat.net/downloads/v2.7.0/${filename}`, { method, headers });
}

test('redirects every supported alias to the same GitHub asset with a new disposition', async () => {
    for (const [filename, asset] of aliases) {
        let requestedUrl;
        globalThis.fetch = async (url, options) => {
            requestedUrl = url;
            assert.equal(options.method, 'GET');
            assert.equal(options.redirect, 'manual');
            return new Response(null, {
                status: 302,
                headers: {
                    Location: `https://release-assets.githubusercontent.com/file?sig=abc&response-content-disposition=${
                        encodeURIComponent(`attachment; filename=${asset}`)}`
                }
            });
        };

        const response = await handleRequest(request(filename));
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        assert.equal(
            requestedUrl,
            `https://github.com/windirstat/windirstat/releases/download/release/v2.7.0/${asset}`
        );
        assert.match(
            response.headers.get('Location'),
            new RegExp(`response-content-disposition=${encodeURIComponent(`attachment; filename=${filename}`)}`)
        );
    }
});

test('rejects unsupported methods, versions, and assets without contacting GitHub', async () => {
    globalThis.fetch = async () => assert.fail('GitHub should not be contacted');

    const methodResponse = await handleRequest(request('WinDirStat-2.7.0-x64.msi', 'POST'));
    assert.equal(methodResponse.status, 405);
    assert.equal(methodResponse.headers.get('Allow'), 'GET, HEAD');

    const versionResponse = await handleRequest(
        new Request('https://windirstat.net/downloads/latest/WinDirStat-x64.msi')
    );
    assert.equal(versionResponse.status, 404);

    const assetResponse = await handleRequest(request('WinDirStat-2.7.0-source.zip'));
    assert.equal(assetResponse.status, 404);
});

test('does not redirect to an insecure or nonstandard GitHub CDN origin', async () => {
    for (const location of [
        'http://release-assets.githubusercontent.com/file?response-content-disposition=old',
        'https://release-assets.githubusercontent.com:444/file?response-content-disposition=old'
    ]) {
        let calls = 0;
        globalThis.fetch = async () => {
            calls++;
            if (calls === 1) {
                return new Response(null, { status: 302, headers: { Location: location } });
            }
            return new Response(new Uint8Array([42]));
        };

        const response = await handleRequest(request('WinDirStat-2.7.0-x64.msi'));
        assert.equal(calls, 2);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename=WinDirStat-2.7.0-x64.msi');
    }
});

test('streams the canonical asset with the requested filename if redirect rewriting is unavailable', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) {
            return new Response(null, {
                status: 302,
                headers: { Location: 'https://release-assets.githubusercontent.com/file?sig=abc' }
            });
        }

        return new Response(new Uint8Array([42]), {
            status: 206,
            headers: {
                'Accept-Ranges': 'bytes',
                'Content-Range': 'bytes 0-0/100'
            }
        });
    };

    const response = await handleRequest(request('WinDirStat-2.7.0-x64.msi', 'GET', {
        'If-Match': '"digest"',
        'If-Unmodified-Since': 'Sat, 01 Aug 2026 00:00:00 GMT',
        Range: 'bytes=0-0'
    }));
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.redirect, 'follow');
    assert.equal(calls[1].options.headers.get('If-Match'), '"digest"');
    assert.equal(calls[1].options.headers.get('If-Unmodified-Since'), 'Sat, 01 Aug 2026 00:00:00 GMT');
    assert.equal(calls[1].options.headers.get('Range'), 'bytes=0-0');
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename=WinDirStat-2.7.0-x64.msi');
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-0/100');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([42]));
});
