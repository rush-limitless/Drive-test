const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
if (fs.existsSync(path.join(root, 'view.html'))) {
    fs.copyFileSync(path.join(root, 'view.html'), path.join(dist, 'view.html'));
}
if (fs.existsSync(path.join(root, 'edit.html'))) {
    fs.copyFileSync(path.join(root, 'edit.html'), path.join(dist, 'edit.html'));
}
copyDir(path.join(root, 'assets'), path.join(dist, 'assets'));
copyDir(path.join(root, 'data'), path.join(dist, 'data'));

console.log('Build complete: dist/');
