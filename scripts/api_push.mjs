#!/usr/bin/env node
// Push a commit to GitHub through the REST API when git transport is down
// (github.com unreachable but api.github.com still answers — see AGENTS.md
// "Remote ops playbook"). Creates blobs → tree → commit → ref, so it needs
// no local git objects and never touches shell quoting or argv limits.
//
// Usage:
//   node scripts/api_push.mjs --repo owner/name --branch feat/x --base staging \
//        --message "feat: thing" file1 file2
//   node scripts/api_push.mjs --repo owner/name --branch feat/x --parent <sha> \
//        --message-file pr-body.md --files a.js,b.js
//
// --base <branch> or --parent <sha> sets the new commit's parent and the
// tree's base — the commit contains exactly the files you list.
// Auth: GITHUB_TOKEN/GH_TOKEN env, else `gh auth token`.

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OWNER_REPO_DEFAULT = 'damitheswitch/therealchina'

const parseArgs = (argv) => {
  const args = { files: [], message: undefined, repo: OWNER_REPO_DEFAULT }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--repo') args.repo = next()
    else if (a === '--branch') args.branch = next()
    else if (a === '--base') args.base = next()
    else if (a === '--parent') args.parent = next()
    else if (a === '--message') args.message = next()
    else if (a === '--message-file') args.message = readFileSync(next(), 'utf8')
    else if (a === '--files')
      args.files.push(...next().split(',').map((s) => s.trim()).filter(Boolean))
    else if (a.startsWith('-')) throw new Error(`unknown flag: ${a}`)
    else args.files.push(a)
  }
  if (!args.repo || !args.branch || (!args.base && !args.parent) || !args.message || !args.files.length) {
    console.error(`usage: node scripts/api_push.mjs --repo owner/name --branch <branch> [--base <branch>|--parent <sha>] --message <msg>|--message-file <path> <files...|--files a,b>`)
    process.exit(1)
  }
  return args
}

const getToken = () => {
  const t = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (t) return t
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim()
  } catch {
    throw new Error('No GITHUB_TOKEN/GH_TOKEN env and `gh auth token` failed')
  }
}

const api = (token, method, path, body) =>
  fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const json = await res.json()
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`)
    return json
  })

const main = async () => {
  const { repo, branch, base, parent, message, files } = parseArgs(process.argv)
  const [owner, name] = repo.split('/')
  const token = getToken()

  const parentSha =
    parent ??
    (await api(token, 'GET', `/repos/${owner}/${name}/git/ref/heads/${base}`)).object.sha
  const parentCommit = await api(token, 'GET', `/repos/${owner}/${name}/git/commits/${parentSha}`)
  console.error(`base ${parentSha} (tree ${parentCommit.tree.sha})`)

  const tree = []
  for (const f of files) {
    if (!existsSync(f)) throw new Error(`file not found: ${f}`)
    const blob = await api(token, 'POST', `/repos/${owner}/${name}/git/blobs`, {
      encoding: 'base64',
      content: readFileSync(f).toString('base64'),
    })
    tree.push({ path: f.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: blob.sha })
    console.error(`blob ${blob.sha.slice(0, 8)}  ${f}`)
  }

  const newTree = await api(token, 'POST', `/repos/${owner}/${name}/git/trees`, {
    base_tree: parentCommit.tree.sha,
    tree,
  })
  const newCommit = await api(token, 'POST', `/repos/${owner}/${name}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: [parentSha],
  })
  console.error(`commit ${newCommit.sha}`)

  try {
    await api(token, 'POST', `/repos/${owner}/${name}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: newCommit.sha,
    })
    console.log(`created refs/heads/${branch}`)
  } catch (e) {
    if (!String(e).includes('422'))
      throw e
    await api(token, 'PATCH', `/repos/${owner}/${name}/git/refs/heads/${branch}`, {
      sha: newCommit.sha,
      force: false,
    })
    console.log(`updated refs/heads/${branch}`)
  }
  console.log(`https://github.com/${owner}/${name}/commit/${newCommit.sha}`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
