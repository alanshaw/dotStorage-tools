import * as raw from 'multiformats/codecs/raw'
import { Block } from 'multiformats/block'
import * as dagPB from '@ipld/dag-pb'
import * as dagCbor from '@ipld/dag-cbor'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('@ipld/car/api').Block} Block
 * @typedef {{ get: (cid: CID) => Promise<Block?> }} Blockstore
 */

/**
 * @param {CID} cid
 * @param {Blockstore[]} blockstores
 */
async function getBlock (cid, blockstores) {
  for (const bs of blockstores) {
    const block = await bs.get(cid)
    if (block) return block
  }
}

/**
 * @param {CID} root
 * @param {Blockstore[]} blockstores
 */
export async function walkDag (root, blockstores) {
  let totalBlocks = 0
  let nextCids = [root]
  while (true) {
    const nextCid = nextCids.shift()
    if (!nextCid) break
    const block = await getBlock(nextCid, blockstores)
    if (!block) throw new Error(`missing block: ${nextCid}`)
    totalBlocks++
    console.log(`${nextCid}`)

    switch (nextCid.code) {
      case raw.code:
        break
      case dagPB.code: {
        const data = dagPB.decode(block.bytes)
        nextCids = [...data.Links.map((l) => l.Hash), ...nextCids]
        break
      }
      case dagCbor.code: {
        const links = new Block({
          cid: nextCid,
          bytes: block.bytes,
          value: dagCbor.decode(block.bytes)
        }).links()
        nextCids = [...links, ...nextCids]
        break
      }
      default:
        throw new Error(`unsupported codec: ${nextCid.code}`)
    }
  }
  console.log(`Total blocks: ${totalBlocks}`)
}
