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

export async function getLatestPrerelease(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching releases: ${response.status}`);
        }

        const data = await response.json();

        const latestPrerelease = data.find(release => release.prerelease);

        if (!latestPrerelease) {
            throw new Error('No prerelease found');
        }

        return {
            version: latestPrerelease.tag_name,
            name: latestPrerelease.name,
            published_at: latestPrerelease.published_at,
            download_url: latestPrerelease.assets[0] ? latestPrerelease.assets[0].browser_download_url : null
        };
    } catch (error) {
        console.error("Failed to fetch the latest pre-release", error);
        return null;
    }
}

const owner = 'windirstat';
const repo = 'windirstat-next';

getLatestPrerelease(owner, repo).then(latestRelease => {
    if (latestRelease) {
        document.getElementById('latest-version').textContent = latestRelease.name.split(' ').pop();
        document.getElementById('release-name').textContent = latestRelease.name;
        document.getElementById('published-date').textContent = new Date(latestRelease.published_at).toLocaleDateString();
        document.getElementById('download-link').href = latestRelease.download_url;
        document.getElementById('download-link').textContent = latestRelease.download_url ? 'Download' : 'No download available';
    } else {
        document.getElementById('latest-version').textContent = 'Unable to fetch release information';
    }
});