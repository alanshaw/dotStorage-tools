#!/usr/bin/env node

import sade from 'sade'
import dotenv from 'dotenv'
import { Cluster } from '@nftstorage/ipfs-cluster'
import fetch from '@web-std/fetch'
import { mustGetEnv } from './utils.js'

const prog = sade('dst')

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
      return console.log(peers.map(p => p.ipfs.addresses[0]).join(','))
    }

    peers.forEach(p => {
      console.log(`# ${p.peerName}`)
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

prog.parse(process.argv)
