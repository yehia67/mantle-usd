import {
  MaxLoopsUpdated as MaxLoopsUpdatedEvent,
  PositionClosed as PositionClosedEvent,
  PositionOpened as PositionOpenedEvent,
  SwapperUpdated as SwapperUpdatedEvent,
  TokensConfigured as TokensConfiguredEvent,
} from '../generated/SuperStake/SuperStake'
import {
  getOrCreateProtocolStats,
  getOrCreateSuperStakePosition,
  getOrCreateUser,
  safeSub,
  updateProtocolTimestamps,
  ZERO_BI,
} from './helpers'

export function handleTokensConfigured(event: TokensConfiguredEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.superstakeMusd = event.params.mUsd
  stats.superstakeMeth = event.params.mEth
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleSwapperUpdated(event: SwapperUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.superstakeSwapper = event.params.swapper
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handleMaxLoopsUpdated(event: MaxLoopsUpdatedEvent): void {
  const stats = getOrCreateProtocolStats()
  stats.superstakeMaxLoops = event.params.maxLoops
  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handlePositionOpened(event: PositionOpenedEvent): void {
  const stats = getOrCreateProtocolStats()
  const userAddress = event.params.user
  const user = getOrCreateUser(userAddress)
  const position = getOrCreateSuperStakePosition(userAddress)

  if (position.openedAtBlock.equals(ZERO_BI)) {
    position.openedAtBlock = event.block.number
    position.openedAtTimestamp = event.block.timestamp
  }

  position.collateralLocked = position.collateralLocked.plus(event.params.collateralLocked)
  position.totalDebtMinted = position.totalDebtMinted.plus(event.params.totalDebtMinted)
  position.loops = event.params.loopsExecuted
  position.active = true
  position.updatedAtBlock = event.block.number
  position.updatedAtTimestamp = event.block.timestamp
  position.closedAtBlock = null
  position.closedAtTimestamp = null
  position.save()

  user.superstakePosition = position.id
  user.save()

  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handlePositionClosed(event: PositionClosedEvent): void {
  const stats = getOrCreateProtocolStats()
  const position = getOrCreateSuperStakePosition(event.params.user)

  position.collateralLocked = safeSub(position.collateralLocked, event.params.collateralReleased)
  position.totalDebtMinted = safeSub(position.totalDebtMinted, event.params.debtBurned)
  position.updatedAtBlock = event.block.number
  position.updatedAtTimestamp = event.block.timestamp

  if (position.collateralLocked.equals(ZERO_BI)) {
    position.active = false
    position.closedAtBlock = event.block.number
    position.closedAtTimestamp = event.block.timestamp
  }

  position.save()

  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}
