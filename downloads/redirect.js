const workerOrigin = 'https://windirstat-downloads.windirstat.workers.dev';

function redirectDownload() {
    const route = window.location.hash.slice(1);
    const match = /^\/v(\d+\.\d+\.\d+)\/([^/]+)$/.exec(route);

    if (match) {
        const [, version, filename] = match;
        const allowedNames = new Set([
            `WinDirStat-${version}-arm64.msi`,
            `WinDirStat-${version}-x64.msi`,
            `WinDirStat-${version}-x86.msi`,
            `WinDirStat-${version}.zip`,
            `WinDirStat-${version}.7z`,
            `WinDirStat-${version}-Hashes.txt`
        ]);

        if (allowedNames.has(filename)) {
            const asset = filename.replace(`WinDirStat-${version}`, 'WinDirStat');
            const fallback = document.getElementById('stable-download');
            fallback.href =
                `https://github.com/windirstat/windirstat/releases/download/release/v${version}/${asset}`;
            fallback.textContent = `download ${asset} from GitHub instead`;
            window.location.replace(`${workerOrigin}/downloads${route}`);
        } else {
            document.getElementById('download-status').textContent = 'That download filename is not available.';
        }
    } else {
        document.getElementById('download-status').textContent = 'That download link is invalid.';
    }
}

window.addEventListener('hashchange', redirectDownload);
redirectDownload();
