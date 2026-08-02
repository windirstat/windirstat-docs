const repository = 'windirstat/windirstat';
const releasesApi = `https://api.github.com/repos/${repository}/releases`;
const pageSize = 100;
const versionedAssets = new Set([
    'WinDirStat-arm.msi',
    'WinDirStat-arm64.msi',
    'WinDirStat-x64.msi',
    'WinDirStat-x86.msi',
    'WinDirStat.7z',
    'WinDirStat.zip',
    'WinDirStat-Hashes.txt',
    'WinDirStat_arm64.msix',
    'WinDirStat_x64.msix',
    'WinDirStat_x86.msix',
    'WinDirStat_x86_x64_arm64.msixbundle'
]);
const hiddenAssets = new Set(['WinDirStat-DebugSymbols.7z']);
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
    const row = document.createElement('tr');
    row.className = 'release-asset';

    const directCell = document.createElement('td');
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
    directCell.appendChild(primary);
    row.appendChild(directCell);

    const versionedCell = document.createElement('td');
    versionedCell.className = 'release-asset-versioned';
    const versioned = getVersionedDownload(release.tag_name, asset.name);
    if (versioned) {
        const versionedLink = document.createElement('a');
        versionedLink.className = 'versioned-download';
        versionedLink.href = versioned.href;
        versionedLink.textContent = versioned.filename;
        versionedLink.setAttribute('aria-label', `Download ${versioned.filename}`);
        versionedCell.appendChild(versionedLink);
    } else {
        const unavailable = document.createElement('span');
        unavailable.className = 'release-asset-unavailable';
        unavailable.textContent = '—';
        unavailable.setAttribute('aria-label', 'No versioned download');
        versionedCell.appendChild(unavailable);
    }
    row.appendChild(versionedCell);

    return row;
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
        ? release.assets.filter(asset => asset.state === 'uploaded' && !hiddenAssets.has(asset.name))
        : [];
    appendText(meta, `${assets.length} ${assets.length === 1 ? 'file' : 'files'}`);
    summary.appendChild(meta);
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'release-body';

    if (assets.length) {
        const table = document.createElement('table');
        table.className = 'release-assets';
        table.setAttribute('aria-label', `${release.name || release.tag_name} downloads`);
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        ['Direct Link', 'Versioned Download'].forEach(label => {
            const heading = document.createElement('th');
            heading.scope = 'col';
            heading.textContent = label;
            header.appendChild(heading);
        });
        head.appendChild(header);
        table.appendChild(head);
        const tableBody = document.createElement('tbody');
        assets.forEach(asset => tableBody.appendChild(createReleaseAsset(release, asset)));
        table.appendChild(tableBody);
        body.appendChild(table);
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
    const list = document.getElementById('current-releases-list');
    const legacyList = document.getElementById('legacy-releases');
    const status = document.getElementById('releases-status');
    const fallback = document.getElementById('releases-fallback');
    if (!list || !status) {
        return;
    }

    status.textContent = 'Loading releases from GitHub…';
    try {
        const releases = (await getReleases())
            .filter(release => !/^release\/v1\./.test(release.tag_name || ''));
        const legacyCount = legacyList ? legacyList.querySelectorAll('.release-card').length : 0;
        list.replaceChildren(...releases.map(createRelease));
        const releaseCount = releases.length + legacyCount;
        status.textContent = `${releaseCount} ${releaseCount === 1 ? 'release' : 'releases'}, newest first.`;
        if (releases.length && fallback) {
            fallback.hidden = true;
        }
        updateLatestVersion(releases);
    } catch (error) {
        console.error('Failed to load releases', error);
        status.textContent = 'The live release list could not be loaded. Please use the GitHub releases link below.';
    }
}

if (typeof document !== 'undefined') {
    loadReleases();
}
