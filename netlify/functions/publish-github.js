const crypto = require('crypto');

async function apiRequest(url, method, token, body) {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'netlify-function'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = { message: text };
    }
    if (!res.ok) {
        throw new Error(`GitHub API ${res.status}: ${json.message || text}`);
    }
    return json;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, X-Publish-Key',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'rush-limitless';
    const repo = process.env.GITHUB_REPO || 'Drive-test';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const path = process.env.GITHUB_FILE_PATH || 'data/dashboard.json';
    const requiredKey = process.env.PUBLISH_KEY;

    if (!token) {
        return { statusCode: 500, body: 'Missing GITHUB_TOKEN' };
    }

    if (requiredKey) {
        const provided = event.headers['x-publish-key'] || event.headers['X-Publish-Key'];
        if (provided !== requiredKey) {
            return { statusCode: 401, body: 'Invalid publish key' };
        }
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const content = JSON.stringify(payload, null, 2);
    const encoded = Buffer.from(content, 'utf8').toString('base64');

    try {
        const fileInfo = await apiRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            'GET',
            token
        );

        const commit = await apiRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            'PUT',
            token,
            {
                message: `Update dashboard.json ${crypto.randomUUID()}`,
                content: encoded,
                sha: fileInfo.sha,
                branch
            }
        );

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ ok: true, commit: commit.commit?.sha })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ ok: false, error: err.message })
        };
    }
};
