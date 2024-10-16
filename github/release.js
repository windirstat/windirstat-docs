export async function getLatestRelease(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching latest release: ${response.status}`);
        }

        const data = await response.json();
        return {
            version: data.tag_name,
            name: data.name,
            published_at: data.published_at,
            download_url: data.assets[0] ? data.assets[0].browser_download_url : null
        };
    } catch (error) {
        console.error("Failed to fetch the latest release", error);
        return null;
    }
}

const owner = 'windirstat';
const repo = 'windirstat';

getLatestRelease(owner, repo).then(latestRelease => {
    if (latestRelease) {
        const latestVersionElement = document.getElementById('latest-version');
        const releaseNameElement = document.getElementById('release-name');
        const publishedDateElement = document.getElementById('published-date');
        const downloadLinkElement = document.getElementById('download-link');

        if (latestVersionElement) {
            latestVersionElement.textContent = latestRelease.version.replace(/.+\/v(.+)/, '$1');
        }

        if (releaseNameElement) {
            releaseNameElement.textContent = latestRelease.name;
        }

        if (publishedDateElement) {
            publishedDateElement.textContent = new Date(latestRelease.published_at).toLocaleDateString();
        }

        if (downloadLinkElement) {
            downloadLinkElement.href = latestRelease.download_url;
            downloadLinkElement.textContent = latestRelease.download_url ? 'Download' : 'No Download Available';
        }

        document.querySelectorAll('a').forEach(link => {
			const href = link.getAttribute('href');
            if (href.startsWith('windirstat:/')) {
                link.setAttribute('href', href.replace(
                    'windirstat:/',
                    `https://github.com/windirstat/windirstat/releases/download/${latestRelease.version}/`
                ));
            }
        });
        
    } else {
        const latestVersionElement = document.getElementById('latest-version');
        if (latestVersionElement) {
            latestVersionElement.textContent = 'N/A';
        }
    }
});