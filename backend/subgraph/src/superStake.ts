import {
  MaxLoopsUpdated as MaxLoopsUpdatedEvent,
  PositionClosed as PositionClosedEvent,
  PositionOpened as PositionOpenedEvent,
  SwapperUpdated as SwapperUpdatedEvent,
  TokensConfigured as TokensConfiguredEvent,
} from '../generated/SuperStake/SuperStake'
import {
  SuperStakePositionHistory,
} from '../generated/schema'
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

  const isNewPosition = position.openedAtBlock.equals(ZERO_BI)
  
  if (isNewPosition) {
    position.openedAtBlock = event.block.number
    position.openedAtTimestamp = event.block.timestamp
  }

  const oldCollateral = position.collateralLocked
  const oldDebt = position.totalDebtMinted

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

  // Create history entry
  const historyId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const history = new SuperStakePositionHistory(historyId)
  history.user = user.id
  history.collateralAmount = position.collateralLocked
  history.debtAmount = position.totalDebtMinted
  history.deltaCollateral = event.params.collateralLocked
  history.deltaDebt = event.params.totalDebtMinted
  history.eventType = isNewPosition ? 'OPEN' : 'DEPOSIT'
  history.loops = event.params.loopsExecuted
  history.timestamp = event.block.timestamp
  history.blockNumber = event.block.number
  history.save()

  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}

export function handlePositionClosed(event: PositionClosedEvent): void {
  const stats = getOrCreateProtocolStats()
  const userAddress = event.params.user
  const user = getOrCreateUser(userAddress)
  const position = getOrCreateSuperStakePosition(userAddress)

  position.collateralLocked = safeSub(position.collateralLocked, event.params.collateralReleased)
  position.totalDebtMinted = safeSub(position.totalDebtMinted, event.params.debtBurned)
  position.updatedAtBlock = event.block.number
  position.updatedAtTimestamp = event.block.timestamp

  const isFullyClosed = position.collateralLocked.equals(ZERO_BI)
  
  if (isFullyClosed) {
    position.active = false
    position.closedAtBlock = event.block.number
    position.closedAtTimestamp = event.block.timestamp
  }

  position.save()

  // Create history entry
  const historyId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  const history = new SuperStakePositionHistory(historyId)
  history.user = user.id
  history.collateralAmount = position.collateralLocked
  history.debtAmount = position.totalDebtMinted
  history.deltaCollateral = ZERO_BI.minus(event.params.collateralReleased) // negative
  history.deltaDebt = ZERO_BI.minus(event.params.debtBurned) // negative
  history.eventType = isFullyClosed ? 'CLOSE' : 'WITHDRAW'
  history.loops = position.loops
  history.timestamp = event.block.timestamp
  history.blockNumber = event.block.number
  history.save()

  updateProtocolTimestamps(stats, event.block.number, event.block.timestamp)
  stats.save()
}
