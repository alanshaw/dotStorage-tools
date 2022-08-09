#!/usr/bin/env node

import sade from 'sade'
import dotenv from 'dotenv'
import { Cluster } from '@nftstorage/ipfs-cluster'
import fetch from '@web-std/fetch'
import { CarIndexedReader } from '@ipld/car'
import { CID } from 'multiformats'
import { base64pad } from 'multiformats/bases/base64'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { mustGetEnv } from './utils.js'
import { walkDag } from './dag-walker.js'

const prog = sade('dotstorage')

prog.version('0.0.0')

prog
  .command('list-cluster-ipfs-peers')
  .describe('Display IPFS peers in the Cluster')
  .option('--csv', 'Change the output format to CSV')
  .action(async (options) => {
    dotenv.config()
    global.fetch = fetch

    const client = new Cluster(mustGetEnv('CLUSTER_API_URL'), {
      headers: { Authorization: `Basic ${mustGetEnv('CLUSTER_BASIC_AUTH_TOKEN')}` }
    })

    const peers = await client.peerList()

    peers.sort((a, b) => a.peerName > b.peerName ? 1 : -1)

    if (options.csv) {
      return console.log(peers.filter(p => !p.error).map(p => p.ipfs.addresses[0]).join(','))
    }

    peers.forEach(p => {
      console.log(`# ${p.peerName || p.id}`)
      if (p.error) return console.error(p.error)
      console.log(p.ipfs.addresses[0])
    })
  })
  .command('show-cluster-cid-status <cid>')
  .describe('Show the status for a CID in Cluster')
  .action(async (cid) => {
    dotenv.config()
    global.fetch = fetch

    const client = new Cluster(mustGetEnv('CLUSTER_API_URL'), {
      headers: { Authorization: `Basic ${mustGetEnv('CLUSTER_BASIC_AUTH_TOKEN')}` }
    })

    const status = await client.status(cid)
    Object.entries(status.peerMap).forEach(([id, info]) => {
      console.log(`    > ${info.peerName || id}: ${info.status.toUpperCase()} | ${info.timestamp.toISOString()}`)
    })
  })
  .command('is-dag-complete <car-path>...')
  .describe('Determine if a CAR file(s) contains a complete DAG')
  .option('--root', 'Root CID of the DAG (derived from CAR files if not set)')
  .action(async (path, options) => {
    const paths = [path, ...options._]
    const readers = await Promise.all(paths.map(f => CarIndexedReader.fromFile(f)))
    let root = options.root ? CID.parse(options.root) : null
    if (!root) {
      for (const r of readers) {
        const roots = await r.getRoots()
        if (roots[0]) {
          root = roots[0]
          break
        }
      }
      if (!root) throw new Error('root not found in CAR(s), use --root to specify')
    }
    console.log(`🦷 Walking DAG from root: ${root}`)
    await walkDag(root, readers)
    console.log(`✅ ${root} is a complete DAG in these CAR(s)`)
  })
  .command('find-advert <content-cid>')
  .describe('Find the advertisement file that contains a CID')
  .option('--url', 'URL of the root location where adverts can be found.', 'https://ipfs-advertisement.s3.us-west-2.amazonaws.com')
  .action(async (contentCid, options) => {
    const endpoint = options.url

    const headUrl = new URL('head', endpoint)
    const headRes = await fetch(headUrl)
    const head = await headRes.json()
    let advertCid = head.head['/']

    const cacheDir = path.join(os.homedir(), '.dotstorage', 'cache', 'find-advert')
    await fs.promises.mkdir(cacheDir, { recursive: true })

    const b64Multihash = base64pad.encode(CID.parse(contentCid).multihash.bytes).slice(1)
    let i = 0
    while (true) {
      console.log(`Advert #${i}: ${advertCid}`)
      const advertUrl = new URL(advertCid, endpoint)
      const advert = await readJson(advertUrl, cacheDir)

      if (!advert.PreviousID) return console.log(`😭 ${contentCid} not advertised`)
      console.log(`  Previous ID: ${advert.PreviousID['/']}`)

      const entriesCid = advert.Entries['/']
      console.log(`  Entries: ${entriesCid}`)
      const entriesUrl = new URL(entriesCid, endpoint)
      const entries = await readJson(entriesUrl, cacheDir)

      const found = entries.Entries.some(e => e['/'] === b64Multihash)
      if (found) return console.log(`✅ ${contentCid} found in advert ${advertCid}`)

      advertCid = advert.PreviousID['/']
      i++
    }
  })

/**
 * Read JSON from a URL and cache it at the passed location.
 * @param {URL} url
 * @param {string} cacheDir
 */
async function readJson (url, cacheDir) {
  const cacheFilePath = path.join(cacheDir, url.pathname)
  try {
    const json = await fs.promises.readFile(cacheFilePath)
    return JSON.parse(json)
  } catch {}
  const res = await fetch(url)
  if (!res.ok) throw new Error(`failed to fetch: ${url}, status: ${res.status}`)
  const json = await res.text()
  const data = JSON.parse(json)
  await fs.promises.writeFile(cacheFilePath, json)
  return data
}

prog.parse(process.argv)
