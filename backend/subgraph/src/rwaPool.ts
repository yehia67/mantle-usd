import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  LiquidityAdded as LiquidityAddedEvent,
  LiquidityRemoved as LiquidityRemovedEvent,
  RWAPool as RWAPoolContract,
  Swap as SwapEvent,
} from '../generated/templates/RWAPool/RWAPool'
import { LiquidityPosition, RWAPool, RWASwap } from '../generated/schema'
import {
  getOrCreateLiquidityPosition,
  getOrCreateProtocolStats,
  getOrCreateUser,
  safeSub,
  updateLiquidityPositionShare,
  updateProtocolTimestamps,
  ZERO_BI,
} from './helpers'

function getPoolEntity(address: Address): RWAPool {
  const id = address.toHexString()
  let pool = RWAPool.load(id)
  if (pool == null) {
    pool = new RWAPool(id)
    pool.poolAddress = address
    pool.musdToken = Address.zero()
    pool.rwaToken = Address.zero()
    pool.assetSymbol = ''
    pool.verifier = Address.zero()
    pool.policyId = Bytes.empty()
    pool.reserveMUSD = ZERO_BI
    pool.reserveRWA = ZERO_BI
    pool.totalLiquidity = ZERO_BI
    pool.totalVolume = ZERO_BI
    pool.totalSwaps = ZERO_BI
    pool.createdAtBlock = ZERO_BI
    pool.createdAtTimestamp = ZERO_BI
  }
  return pool as RWAPool
}

function syncPoolState(pool: RWAPool, contract: RWAPoolContract): void {
  const reserveMUSD = contract.try_reserveMUSD()
  if (!reserveMUSD.reverted) {
    pool.reserveMUSD = reserveMUSD.value
  }

  const reserveRWA = contract.try_reserveRWA()
  if (!reserveRWA.reverted) {
    pool.reserveRWA = reserveRWA.value
  }

  const totalLiquidity = contract.try_totalLiquidity()
  if (!totalLiquidity.reverted) {
    pool.totalLiquidity = totalLiquidity.value
  }
}

function updatePositionShare(position: LiquidityPosition, pool: RWAPool, contract: RWAPoolContract): void {
  const balanceResult = contract.try_liquidityBalances(Address.fromString(position.user))
  if (!balanceResult.reverted) {
    position.liquidityProvided = balanceResult.value
  }

  updateLiquidityPositionShare(position, pool)
  position.blockNumber = pool.createdAtBlock
}

function updatePosition(
  address: Address,
  pool: RWAPool,
  contract: RWAPoolContract,
  blockNumber: BigInt,
  timestamp: BigInt,
): LiquidityPosition {
  const position = getOrCreateLiquidityPosition(address, pool.id)
  const balanceResult = contract.try_liquidityBalances(address)
  if (!balanceResult.reverted) {
    position.liquidityProvided = balanceResult.value
  }

  updateLiquidityPositionShare(position, pool)
  position.blockNumber = blockNumber
  position.timestamp = timestamp
  position.save()

  return position
}

export function handleLiquidityAdded(event: LiquidityAddedEvent): void {
  const pool = getPoolEntity(event.address)
  const contract = RWAPoolContract.bind(event.address)

  syncPoolState(pool, contract)
  pool.totalVolume = pool.totalVolume.plus(event.params.amountMUSD).plus(event.params.amountRWA)
  pool.save()

  updatePosition(event.params.provider, pool, contract, event.block.number, event.block.timestamp)

  const stats = getOrCreateProtocolStats()
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleLiquidityRemoved(event: LiquidityRemovedEvent): void {
  const pool = getPoolEntity(event.address)
  const contract = RWAPoolContract.bind(event.address)

  syncPoolState(pool, contract)
  pool.reserveMUSD = safeSub(pool.reserveMUSD, event.params.amountMUSD)
  pool.reserveRWA = safeSub(pool.reserveRWA, event.params.amountRWA)
  pool.save()

  updatePosition(event.params.provider, pool, contract, event.block.number, event.block.timestamp)

  const stats = getOrCreateProtocolStats()
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleSwap(event: SwapEvent): void {
  const pool = getPoolEntity(event.address)
  const contract = RWAPoolContract.bind(event.address)
  const user = getOrCreateUser(event.params.user)

  syncPoolState(pool, contract)
  pool.totalVolume = pool.totalVolume.plus(event.params.amountIn)
  pool.totalSwaps = pool.totalSwaps.plus(BigInt.fromI32(1))
  pool.save()

  const swapId = event.transaction.hash.toHex().concat('-').concat(event.logIndex.toString())
  const swap = new RWASwap(swapId)
  swap.pool = pool.id
  swap.user = user.id
  swap.tokenIn = event.params.tokenIn
  swap.tokenOut = event.params.tokenOut
  swap.amountIn = event.params.amountIn
  swap.amountOut = event.params.amountOut
  swap.txHash = event.transaction.hash
  swap.timestamp = event.block.timestamp
  swap.blockNumber = event.block.number
  swap.save()

  const stats = getOrCreateProtocolStats()
  stats.totalVolume = stats.totalVolume.plus(event.params.amountIn)
  stats.totalSwaps = pool.totalSwaps
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}
