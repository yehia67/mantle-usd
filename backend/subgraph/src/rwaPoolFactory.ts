import { Address } from '@graphprotocol/graph-ts'
import { PoolCreated as PoolCreatedEvent } from '../generated/RWAPoolFactory/RWAPoolFactory'
import { ERC20 } from '../generated/RWAPoolFactory/ERC20'
import { RWAPool } from '../generated/schema'
import { RWAPool as RWAPoolTemplate } from '../generated/templates'
import { getOrCreateProtocolStats, updateProtocolTimestamps, ZERO_BI } from './helpers'

function getTokenSymbol(token: Address): string {
  const erc20 = ERC20.bind(token)
  const symbolResult = erc20.try_symbol()
  if (!symbolResult.reverted) {
    return symbolResult.value
  }
  return ''
}

export function handlePoolCreated(event: PoolCreatedEvent): void {
  const poolId = event.params.pool.toHexString()
  let pool = RWAPool.load(poolId)
  if (pool == null) {
    pool = new RWAPool(poolId)
  }

  pool.poolAddress = event.params.pool
  pool.musdToken = event.params.mUSD
  pool.rwaToken = event.params.rwaToken
  pool.assetSymbol = getTokenSymbol(event.params.rwaToken)
  pool.verifier = event.params.verifier
  pool.policyId = event.params.imageId
  pool.reserveMUSD = ZERO_BI
  pool.reserveRWA = ZERO_BI
  pool.totalLiquidity = ZERO_BI
  pool.totalVolume = ZERO_BI
  pool.totalSwaps = ZERO_BI
  pool.createdAtBlock = event.block.number
  pool.createdAtTimestamp = event.block.timestamp
  pool.save()

  RWAPoolTemplate.create(event.params.pool)

  const stats = getOrCreateProtocolStats()
  stats.totalPools = stats.totalPools + 1
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}
