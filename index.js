#!/usr/bin/env node

import sade from 'sade'
import dotenv from 'dotenv'
import { Cluster } from '@nftstorage/ipfs-cluster'
import fetch from '@web-std/fetch'
import { CarIndexedReader } from '@ipld/car'
import { CID } from 'multiformats'
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

prog.parse(process.argv)
