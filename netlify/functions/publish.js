const crypto = require('crypto');

function sha1(content) {
    return crypto.createHash('sha1').update(content).digest('hex');
}

async function apiRequest(url, method, token, body) {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Netlify API error ${res.status}: ${text}`);
    }
    return res.json();
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

    const token = process.env.NETLIFY_AUTH_TOKEN;
    const siteId = process.env.NETLIFY_SITE_ID;
    const requiredKey = process.env.PUBLISH_KEY;

    if (!token || !siteId) {
        return { statusCode: 500, body: 'Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID' };
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
    } catch (err) {
        return { statusCode: 400, body: 'Invalid JSON' };
    }

    const jsonContent = JSON.stringify(payload, null, 2);
    const jsonHash = sha1(jsonContent);

    try {
        const deploys = await apiRequest(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=1`,
            'GET',
            token
        );

        if (!Array.isArray(deploys) || deploys.length === 0) {
            return { statusCode: 500, body: 'No existing deploys found' };
        }

        const latestDeployId = deploys[0].id;
        const files = await apiRequest(
            `https://api.netlify.com/api/v1/deploys/${latestDeployId}/files`,
            'GET',
            token
        );

        const fileMap = {};
        files.forEach((file) => {
            fileMap[file.path] = file.sha;
        });
        fileMap['data/dashboard.json'] = jsonHash;

        const newDeploy = await apiRequest(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
            'POST',
            token,
            { files: fileMap }
        );

        if (Array.isArray(newDeploy.required) && newDeploy.required.includes('data/dashboard.json')) {
            const uploadRes = await fetch(
                `https://api.netlify.com/api/v1/deploys/${newDeploy.id}/files/data/dashboard.json`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: jsonContent
                }
            );
            if (!uploadRes.ok) {
                const text = await uploadRes.text();
                throw new Error(`Upload failed ${uploadRes.status}: ${text}`);
            }
        }

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ ok: true, deployId: newDeploy.id })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ ok: false, error: err.message })
        };
    }
};
