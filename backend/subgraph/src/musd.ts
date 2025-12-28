import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
  CollateralAssetUpdated as CollateralAssetUpdatedEvent,
  CollateralLocked as CollateralLockedEvent,
  CollateralUnlocked as CollateralUnlockedEvent,
  CollateralPriceUpdated as CollateralPriceUpdatedEvent,
  MinHealthFactorUpdated as MinHealthFactorUpdatedEvent,
  MintPercentageUpdated as MintPercentageUpdatedEvent,
  PositionLiquidated as PositionLiquidatedEvent,
} from '../generated/mUSD/mUSD'
import {
  adjustActiveUsers,
  calculateHealthFactor,
  createMUSDPositionSnapshot,
  getOrCreateProtocolStats,
  getOrCreateUser,
  getCollateralPrice,
  isUserActive,
  safeSub,
  updateProtocolTimestamps,
  ZERO_BI,
  ZERO_BD,
  NEG_ONE_BI,
} from './helpers'

const EVENT_LOCK = 'LOCK'
const EVENT_UNLOCK = 'UNLOCK'
const EVENT_LIQUIDATION = 'LIQUIDATION'

function updateUserHealthFactor(collateral: BigInt, debt: BigInt, price: BigInt): BigDecimal {
  if (collateral.equals(ZERO_BI) || price.equals(ZERO_BI)) {
    return ZERO_BD
  }
  return calculateHealthFactor(collateral, debt, price)
}

export function handleCollateralAssetUpdated(event: CollateralAssetUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.collateralAsset = event.params.asset
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleMintPercentageUpdated(event: MintPercentageUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.mintPercentageBps = event.params.bps.toI32()
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleCollateralPriceUpdated(event: CollateralPriceUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.collateralPriceUsd = event.params.price
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleMinHealthFactorUpdated(event: MinHealthFactorUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.minHealthFactor = event.params.newFactor
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleCollateralLocked(event: CollateralLockedEvent): void {
  const stats = getOrCreateProtocolStats()
  const user = getOrCreateUser(event.params.account)
  const wasActive = isUserActive(user)

  user.collateralBalance = user.collateralBalance.plus(event.params.collateralAmount)
  user.debtBalance = user.debtBalance.plus(event.params.mintedAmount)
  user.musdBalance = user.musdBalance.plus(event.params.mintedAmount)

  const healthFactor = updateUserHealthFactor(user.collateralBalance, user.debtBalance, getCollateralPrice(stats))
  user.healthFactor = healthFactor
  user.save()

  stats.totalCollateral = stats.totalCollateral.plus(event.params.collateralAmount)
  stats.totalDebt = stats.totalDebt.plus(event.params.mintedAmount)
  stats.totalSupply = stats.totalSupply.plus(event.params.mintedAmount)

  adjustActiveUsers(stats, wasActive, isUserActive(user))
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()

  createMUSDPositionSnapshot(
    event,
    user.id,
    user.collateralBalance,
    user.debtBalance,
    event.params.collateralAmount,
    event.params.mintedAmount,
    EVENT_LOCK,
    healthFactor,
  )
}

export function handleCollateralUnlocked(event: CollateralUnlockedEvent): void {
  const stats = getOrCreateProtocolStats()
  const user = getOrCreateUser(event.params.account)
  const wasActive = isUserActive(user)

  user.collateralBalance = safeSub(user.collateralBalance, event.params.collateralAmount)
  user.debtBalance = safeSub(user.debtBalance, event.params.burnedAmount)
  user.musdBalance = safeSub(user.musdBalance, event.params.burnedAmount)

  const healthFactor = updateUserHealthFactor(user.collateralBalance, user.debtBalance, getCollateralPrice(stats))
  user.healthFactor = healthFactor
  user.save()

  stats.totalCollateral = safeSub(stats.totalCollateral, event.params.collateralAmount)
  stats.totalDebt = safeSub(stats.totalDebt, event.params.burnedAmount)
  stats.totalSupply = safeSub(stats.totalSupply, event.params.burnedAmount)

  adjustActiveUsers(stats, wasActive, isUserActive(user))
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()

  createMUSDPositionSnapshot(
    event,
    user.id,
    user.collateralBalance,
    user.debtBalance,
    event.params.collateralAmount.times(NEG_ONE_BI),
    event.params.burnedAmount.times(NEG_ONE_BI),
    EVENT_UNLOCK,
    healthFactor,
  )
}

export function handlePositionLiquidated(event: PositionLiquidatedEvent): void {
  const stats = getOrCreateProtocolStats()
  const user = getOrCreateUser(event.params.account)
  const wasActive = isUserActive(user)

  user.collateralBalance = safeSub(user.collateralBalance, event.params.collateralSeized)
  user.debtBalance = safeSub(user.debtBalance, event.params.debtBurned)
  const healthFactor = updateUserHealthFactor(user.collateralBalance, user.debtBalance, getCollateralPrice(stats))
  user.healthFactor = healthFactor
  user.save()

  stats.totalCollateral = safeSub(stats.totalCollateral, event.params.collateralSeized)
  stats.totalDebt = safeSub(stats.totalDebt, event.params.debtBurned)
  stats.totalSupply = safeSub(stats.totalSupply, event.params.debtBurned)

  adjustActiveUsers(stats, wasActive, isUserActive(user))
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()

  createMUSDPositionSnapshot(
    event,
    user.id,
    user.collateralBalance,
    user.debtBalance,
    event.params.collateralSeized.times(NEG_ONE_BI),
    event.params.debtBurned.times(NEG_ONE_BI),
    EVENT_LIQUIDATION,
    healthFactor,
  )
}
