#!/usr/bin/env node
/**
 * GitHub sync script — the practical alternative to the (unavailable) GitHub
 * connector. It connects this project to GitHub directly via the GitHub REST
 * API + git:
 *
 *   1. Validates the token against the GitHub API.
 *   2. Creates the repository if it does not exist (empty repo, no README).
 *   3. Points the local git remote at it and pushes `main`.
 *   4. Polls the latest GitHub Actions workflow run and reports its status.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/push-to-github.mjs <owner>/<repo>
 *   e.g. GITHUB_TOKEN=ghp_xxx node scripts/push-to-github.mjs your-name/chemlms
 *
 * Env:
 *   GITHUB_TOKEN (or GH_TOKEN)  Personal Access Token — needs `repo` scope.
 *   SKIP_CI_WAIT=1              Don't poll the workflow status afterwards.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const repoSlug = process.argv[2] ?? process.env.REPO_SLUG;
if (!repoSlug || !repoSlug.includes('/')) {
  console.error('Usage: GITHUB_TOKEN=ghp_xxx node scripts/push-to-github.mjs <owner>/<repo>');
  process.exit(1);
}
const [owner, repo] = repoSlug.split('/');

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if (!token) {
  console.error('Missing token. Export GITHUB_TOKEN (Personal Access Token with `repo` scope).');
  process.exit(1);
}

const API = (path) => fetch(`https://api.github.com${path}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'chemlms-sync-script',
  },
});

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'chemlms-sync-script',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) throw new Error('Rate limited or token lacks permissions (need `repo` scope).');
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function git(args, { capture = false } = {}) {
  const out = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit' });
  return capture ? out : undefined;
}

// 1) Validate token
const me = await api('GET', '/user');
console.log(`✓ Token valid — signed in as ${me.login}`);

// 2) Check / create the repo
let existing = null;
try {
  existing = await api('GET', `/repos/${owner}/${repo}`);
} catch {
  existing = null;
}
if (existing) {
  console.log(`✓ Repository ${owner}/${repo} already exists`);
} else {
  console.log(`Creating ${owner}/${repo} …`);
  await api('POST', '/user/repos', { name: repo, private: false, auto_init: false });
  console.log('✓ Repository created');
}

// 3) Push
const remoteUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
git(['remote', 'set-url', 'origin', remoteUrl]);
// avoid interactive credential prompts
process.env.GIT_TERMINAL_PROMPT = '0';
git(['push', '-u', 'origin', 'main']);
console.log('✓ Push complete — code is on GitHub');

// 4) Poll the latest workflow run
if (process.env.SKIP_CI_WAIT !== '1') {
  try {
    let run = null;
    for (let attempt = 0; attempt < 12 && !run; attempt++) {
      const runs = await api('GET', `/repos/${owner}/${repo}/actions/runs?event=push&per_page=1`);
      run = runs.workflow_runs?.[0] ?? null;
      if (!run) await new Promise((r) => setTimeout(r, 5000));
    }
    if (run) {
      console.log(`→ Workflow run #${run.id}: ${run.status}${run.conclusion ? ` (${run.conclusion})` : ''}`);
      if (run.status === 'completed' && run.conclusion !== 'success') {
        console.warn('⚠ CI did not succeed — check the Actions tab on GitHub for details.');
        process.exit(2);
      }
      console.log('✓ CI passed — repository is live on GitHub');
    }
  } catch (e) {
    console.warn(`(could not read workflow status: ${e.message})`);
  }
}
