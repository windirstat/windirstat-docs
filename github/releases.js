const repository = 'windirstat/windirstat';
const releasesApi = `https://api.github.com/repos/${repository}/releases`;
const pageSize = 100;
const versionedAssets = new Set([
    'WinDirStat-arm64.msi',
    'WinDirStat-x64.msi',
    'WinDirStat-x86.msi',
    'WinDirStat.7z',
    'WinDirStat.zip',
    'WinDirStat-Hashes.txt'
]);
const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});
const sizeFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function releaseTimestamp(release) {
    return Date.parse(release.published_at || release.created_at) || 0;
}

export async function getReleases(fetcher = globalThis.fetch) {
    const releases = [];

    for (let page = 1; ; page++) {
        const response = await fetcher(`${releasesApi}?per_page=${pageSize}&page=${page}`, {
            headers: { Accept: 'application/vnd.github+json' }
        });
        if (!response.ok) {
            throw new Error(`GitHub returned ${response.status} while loading releases.`);
        }

        const batch = await response.json();
        if (!Array.isArray(batch)) {
            throw new Error('GitHub returned an unexpected releases response.');
        }

        releases.push(...batch);
        if (batch.length < pageSize) {
            break;
        }
    }

    return releases
        .filter(release => !release.draft && !release.prerelease && release.published_at)
        .sort((left, right) => releaseTimestamp(right) - releaseTimestamp(left));
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return '';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${sizeFormatter.format(value)} ${units[unit]}`;
}

export function getVersionedDownload(tagName, assetName) {
    const match = /^release\/v(\d+\.\d+\.\d+)$/.exec(tagName || '');
    if (!match || !versionedAssets.has(assetName)) {
        return null;
    }

    const version = match[1];
    const filename = assetName.replace(/^WinDirStat/, `WinDirStat-${version}`);
    return {
        filename,
        href: `/downloads/#/v${version}/${encodeURIComponent(filename)}`
    };
}

function appendText(element, text) {
    element.appendChild(document.createTextNode(text));
}

function createReleaseAsset(release, asset) {
    const item = document.createElement('li');
    item.className = 'release-asset';

    const primary = document.createElement('span');
    primary.className = 'release-asset-primary';
    const link = document.createElement('a');
    link.href = asset.browser_download_url;
    link.textContent = asset.name;
    link.setAttribute('aria-label', `Download ${asset.name}`);
    primary.appendChild(link);

    const size = formatBytes(asset.size);
    if (size) {
        const sizeElement = document.createElement('span');
        sizeElement.className = 'release-asset-size';
        sizeElement.textContent = size;
        primary.appendChild(sizeElement);
    }
    item.appendChild(primary);

    const versioned = getVersionedDownload(release.tag_name, asset.name);
    if (versioned) {
        const versionedLink = document.createElement('a');
        versionedLink.className = 'versioned-download';
        versionedLink.href = versioned.href;
        versionedLink.textContent = versioned.filename;
        versionedLink.setAttribute('aria-label', `Download ${versioned.filename} with the version in the filename`);
        versionedLink.title = 'Download with the version in the filename';
        item.appendChild(versionedLink);
    }

    return item;
}

function createRelease(release, index) {
    const details = document.createElement('details');
    details.className = 'release-card';
    details.open = index === 0;

    const summary = document.createElement('summary');
    summary.className = 'release-summary';
    const title = document.createElement('span');
    title.className = 'release-title';
    title.textContent = release.name || release.tag_name;
    summary.appendChild(title);

    const badge = document.createElement('span');
    badge.className = 'release-badge';
    badge.textContent = 'Stable';
    summary.appendChild(badge);

    const meta = document.createElement('span');
    meta.className = 'release-meta';
    const dateValue = release.published_at || release.created_at;
    if (dateValue) {
        const time = document.createElement('time');
        time.dateTime = dateValue;
        time.textContent = dateFormatter.format(new Date(dateValue));
        meta.appendChild(time);
        appendText(meta, ' · ');
    }
    const assets = Array.isArray(release.assets)
        ? release.assets.filter(asset => asset.state === 'uploaded')
        : [];
    appendText(meta, `${assets.length} ${assets.length === 1 ? 'file' : 'files'}`);
    summary.appendChild(meta);
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'release-body';

    if (assets.length) {
        const list = document.createElement('ul');
        list.className = 'release-assets';
        assets.forEach(asset => list.appendChild(createReleaseAsset(release, asset)));
        body.appendChild(list);
    } else {
        const empty = document.createElement('p');
        empty.textContent = 'This release has no separately uploaded files.';
        body.appendChild(empty);
    }

    details.appendChild(body);
    return details;
}

function updateLatestVersion(releases) {
    const release = releases[0];
    const versionElement = document.getElementById('latest-version');
    if (!release || !versionElement) {
        return;
    }

    const match = /^release\/v(.+)$/.exec(release.tag_name || '');
    const link = document.createElement('a');
    link.href = 'download.html';
    link.textContent = match ? match[1] : release.name;
    versionElement.replaceChildren(link);

    const publishedDate = document.getElementById('published-date');
    if (publishedDate && release.published_at) {
        publishedDate.textContent = `Released: ${dateFormatter.format(new Date(release.published_at))}`;
        publishedDate.hidden = false;
    }
}

async function loadReleases() {
    const list = document.getElementById('releases-list');
    const status = document.getElementById('releases-status');
    if (!list || !status) {
        return;
    }

    status.textContent = 'Loading stable releases from GitHub…';
    try {
        const releases = await getReleases();
        list.replaceChildren(...releases.map(createRelease));
        status.textContent = releases.length
            ? `${releases.length} stable releases, newest first.`
            : 'No stable releases are currently available.';
        updateLatestVersion(releases);
    } catch (error) {
        console.error('Failed to load releases', error);
        status.textContent = 'The live release list could not be loaded. Please use the GitHub releases link below.';
    }
}

if (typeof document !== 'undefined') {
    loadReleases();
}
