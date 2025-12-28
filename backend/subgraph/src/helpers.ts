import { Address, BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { LiquidityPosition, ProtocolStats, RWAPool, SuperStakePosition, User, mUSDPosition } from '../generated/schema'

export const ZERO_BI = BigInt.zero()
export const ZERO_BD = BigDecimal.fromString('0')
export const HUNDRED_BD = BigDecimal.fromString('100')
export const PRICE_SCALE = BigInt.fromString('1000000000000000000')
export const ONE_BI = BigInt.fromI32(1)
export const NEG_ONE_BI = BigInt.fromI32(-1)
const PERCENTAGE_SCALE = BigInt.fromI32(100)

export function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load('global')
  if (stats == null) {
    stats = new ProtocolStats('global')
    stats.totalSupply = ZERO_BI
    stats.totalDebt = ZERO_BI
    stats.totalCollateral = ZERO_BI
    stats.activeUsers = 0
    stats.totalPools = 0
    stats.totalVolume = ZERO_BI
    stats.totalSwaps = ZERO_BI
    stats.collateralAsset = null
    stats.mintPercentageBps = 0
    stats.collateralPriceUsd = ZERO_BI
    stats.minHealthFactor = ZERO_BI
    stats.superstakeMusd = null
    stats.superstakeMeth = null
    stats.superstakeSwapper = null
    stats.superstakeMaxLoops = 0
    stats.updatedAtBlock = ZERO_BI
    stats.updatedAtTimestamp = ZERO_BI
    stats.save()
  } else if (stats.totalSwaps === null) {
    stats.totalSwaps = ZERO_BI
    stats.save()
  }
  return stats as ProtocolStats
}

export function getOrCreateUser(address: Address): User {
  let id = address.toHexString()
  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.address = address
    user.musdBalance = ZERO_BI
    user.debtBalance = ZERO_BI
    user.collateralBalance = ZERO_BI
    user.healthFactor = ZERO_BD
    user.save()
  }
  return user as User
}

export function isUserActive(user: User): boolean {
  return user.collateralBalance.gt(ZERO_BI) || user.debtBalance.gt(ZERO_BI)
}

export function adjustActiveUsers(stats: ProtocolStats, wasActive: boolean, isActive: boolean): void {
  if (!wasActive && isActive) {
    stats.activeUsers = stats.activeUsers + 1
  } else if (wasActive && !isActive && stats.activeUsers > 0) {
    stats.activeUsers = stats.activeUsers - 1
  }
}

export function safeSub(value: BigInt, amount: BigInt): BigInt {
  return value.gt(amount) ? value.minus(amount) : ZERO_BI
}

export function getOrCreateLiquidityPosition(user: Address, poolId: string): LiquidityPosition {
  let id = poolId.concat('-').concat(user.toHexString())
  let position = LiquidityPosition.load(id)
  if (position == null) {
    position = new LiquidityPosition(id)
    position.user = user.toHexString()
    position.pool = poolId
    position.liquidityProvided = ZERO_BI
    position.amountMUSD = ZERO_BI
    position.amountRWA = ZERO_BI
    position.blockNumber = ZERO_BI
    position.timestamp = ZERO_BI
    position.save()
  }
  return position as LiquidityPosition
}

export function updateProtocolTimestamps(stats: ProtocolStats, blockNumber: BigInt, timestamp: BigInt): void {
  stats.updatedAtBlock = blockNumber
  stats.updatedAtTimestamp = timestamp
}

export function toPercentage(value: BigInt): BigDecimal {
  if (value.equals(ZERO_BI)) {
    return ZERO_BD
  }
  return value.toBigDecimal().div(HUNDRED_BD)
}

export function calculateHealthFactor(collateral: BigInt, debt: BigInt, collateralPriceUsd: BigInt): BigDecimal {
  if (debt.equals(ZERO_BI) || collateralPriceUsd.equals(ZERO_BI)) {
    return ZERO_BD
  }

  const collateralValueUsd = collateral.times(collateralPriceUsd).div(PRICE_SCALE)
  if (collateralValueUsd.equals(ZERO_BI)) {
    return ZERO_BD
  }

  const numerator = collateralValueUsd.times(PERCENTAGE_SCALE)
  return numerator.toBigDecimal().div(debt.toBigDecimal())
}

export function createMUSDPositionSnapshot(
  event: ethereum.Event,
  userId: string,
  collateral: BigInt,
  debt: BigInt,
  deltaCollateral: BigInt,
  deltaDebt: BigInt,
  eventType: string,
  healthFactor: BigDecimal,
): void {
  const id = event.transaction.hash.toHex().concat('-').concat(event.logIndex.toString())
  let position = new mUSDPosition(id)
  position.user = userId
  position.collateralAmount = collateral
  position.debtAmount = debt
  position.deltaCollateral = deltaCollateral
  position.deltaDebt = deltaDebt
  position.eventType = eventType
  position.healthFactor = healthFactor
  position.lastUpdatedBlock = event.block.number
  position.lastUpdatedTimestamp = event.block.timestamp
  position.save()
}

export function getOrCreateSuperStakePosition(user: Address): SuperStakePosition {
  const id = user.toHexString()
  let position = SuperStakePosition.load(id)
  if (position == null) {
    position = new SuperStakePosition(id)
    position.user = id
    position.collateralLocked = ZERO_BI
    position.totalDebtMinted = ZERO_BI
    position.loops = 0
    position.active = false
    position.openedAtBlock = ZERO_BI
    position.openedAtTimestamp = ZERO_BI
    position.updatedAtBlock = ZERO_BI
    position.updatedAtTimestamp = ZERO_BI
    position.closedAtBlock = null
    position.closedAtTimestamp = null
    position.save()
  }
  return position as SuperStakePosition
}

export function updateLiquidityPositionShare(position: LiquidityPosition, pool: RWAPool): void {
  if (pool.totalLiquidity.equals(ZERO_BI) || position.liquidityProvided.equals(ZERO_BI)) {
    position.amountMUSD = ZERO_BI
    position.amountRWA = ZERO_BI
    return
  }

  position.amountMUSD = pool.reserveMUSD.times(position.liquidityProvided).div(pool.totalLiquidity)
  position.amountRWA = pool.reserveRWA.times(position.liquidityProvided).div(pool.totalLiquidity)
}

export function getCollateralPrice(stats: ProtocolStats): BigInt {
  return stats.collateralPriceUsd ? (stats.collateralPriceUsd as BigInt) : ZERO_BI
}
