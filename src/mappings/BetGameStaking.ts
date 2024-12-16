import {
  Address,
  dataSource,
  DataSourceContext,
  DataSourceTemplate,
  BigInt,
} from "@graphprotocol/graph-ts";

import {
  StakingPool,
  StakingPlayer,
  StakingStake,
  StakingUnStake,
  StakingClaim,
  StakingFundGame,
  BetGame,
} from "../../generated/schema";
import {
  Staked,
  Unstaked,
  RewardPaid,
  RewardCompounded,
  AutoCompoundSet,
  FundsProvidedToBetGame,
  BetGameStaking,
} from "../../generated/templates/BetGameStaking/BetGameStaking";
import { findOrCreateUser, getBetGame, ZERO_BIGINT } from "../utils";

export function handleStaked(event: Staked): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const gameAddr = dataSource.context().get("betGame")!.toString();
  const betGame = getBetGame(chainId, Address.fromString(gameAddr));
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let stake = StakingStake.load(key);
  if (!stake) {
    stake = new StakingStake(key);
    stake.chainId = chainId;
    stake.game = betGame.id;
    stake.player = player.id;
    stake.amount = item.amount;

    stake.createdAt = event.block.timestamp;
    stake.txHash = event.transaction.hash;

    stake.save();

    // StakingPlayer
    const contract = BetGameStaking.bind(event.address);
    const data = contract.stakes(item.user);
    const pendingReward = contract.getPendingRewards(item.user);

    const playerKey = `${betGame.id}_${player.id}`;
    let betPlayer = StakingPlayer.load(playerKey);
    if (!betPlayer) {
      betPlayer = new StakingPlayer(playerKey);
      betPlayer.chainId = chainId;
      betPlayer.game = betGame.id;
      betPlayer.player = player.id;

      betPlayer.stakes = ZERO_BIGINT;
      betPlayer.rewards = ZERO_BIGINT;
      betPlayer.claims = ZERO_BIGINT;
    }
    betPlayer.amount = data.getAmount();
    betPlayer.weightedAmount = data.getWeightedAmount();
    betPlayer.rewardDebt = data.getRewardDebt();
    betPlayer.autoCompound = data.getAutoCompound();
    betPlayer.lastUpdateTimestamp = data.getLastUpdateTimestamp();
    betPlayer.stakes = betPlayer.stakes.plus(item.amount);
    betPlayer.rewards = betPlayer.claims.plus(pendingReward); 
    betPlayer.save();

    // StakingPool
    updateStakingPool(chainId, betGame, event.address, ZERO_BIGINT);
  }
}

export function handleUnstaked(event: Unstaked): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const gameAddr = dataSource.context().get("betGame")!.toString();
  const betGame = getBetGame(chainId, Address.fromString(gameAddr));
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let stake = StakingUnStake.load(key);
  if (!stake) {
    stake = new StakingUnStake(key);
    stake.chainId = chainId;
    stake.game = betGame.id;
    stake.player = player.id;
    stake.amount = item.amount;
    stake.fee = item.fee;
    stake.reward = item.reward;

    stake.createdAt = event.block.timestamp;
    stake.txHash = event.transaction.hash;

    stake.save();

    // StakingPlayer
    const contract = BetGameStaking.bind(event.address);
    const data = contract.stakes(item.user);

    const playerKey = `${betGame.id}_${player.id}`;
    let betPlayer = StakingPlayer.load(playerKey);
    if (betPlayer) {
      betPlayer.amount = data.getAmount();
      betPlayer.weightedAmount = data.getWeightedAmount();
      betPlayer.rewardDebt = data.getRewardDebt();
      betPlayer.autoCompound = data.getAutoCompound();
      betPlayer.lastUpdateTimestamp = data.getLastUpdateTimestamp();
      betPlayer.rewards = betPlayer.claims; 
      betPlayer.save();
    }

    // StakingPool
    updateStakingPool(chainId, betGame, event.address, ZERO_BIGINT);
  }
}

export function handleRewardPaid(event: RewardPaid): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const gameAddr = dataSource.context().get("betGame")!.toString();
  const betGame = getBetGame(chainId, Address.fromString(gameAddr));
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let stake = StakingClaim.load(key);
  if (!stake) {
    stake = new StakingClaim(key);
    stake.chainId = chainId;
    stake.game = betGame.id;
    stake.player = player.id;
    stake.amount = item.reward;

    stake.createdAt = event.block.timestamp;
    stake.txHash = event.transaction.hash;

    stake.save();

    // StakingPlayer
    const contract = BetGameStaking.bind(event.address);
    const data = contract.stakes(item.user);
    const playerKey = `${betGame.id}_${player.id}`;
    let betPlayer = StakingPlayer.load(playerKey);
    if (betPlayer) {
      betPlayer.amount = data.getAmount();
      betPlayer.weightedAmount = data.getWeightedAmount();
      betPlayer.rewardDebt = data.getRewardDebt();
      betPlayer.autoCompound = data.getAutoCompound();
      betPlayer.lastUpdateTimestamp = data.getLastUpdateTimestamp();

      betPlayer.claims = betPlayer.claims.plus(item.reward);

      betPlayer.save();
    }

    // StakingPool
    updateStakingPool(chainId, betGame, event.address, ZERO_BIGINT);
  }
}

export function handleRewardCompounded(event: RewardCompounded): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const gameAddr = dataSource.context().get("betGame")!.toString();
  const betGame = getBetGame(chainId, Address.fromString(gameAddr));
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let stake = StakingStake.load(key);
  if (!stake) {
    stake = new StakingStake(key);
    stake.chainId = chainId;
    stake.game = betGame.id;
    stake.player = player.id;
    stake.amount = item.reward;

    stake.createdAt = event.block.timestamp;
    stake.txHash = event.transaction.hash;

    stake.save();

    // StakingPlayer
    const contract = BetGameStaking.bind(event.address);
    const data = contract.stakes(item.user);
    const playerKey = `${betGame.id}_${player.id}`;
    let betPlayer = StakingPlayer.load(playerKey);
    if (betPlayer) {
      betPlayer.amount = data.getAmount();
      betPlayer.weightedAmount = data.getWeightedAmount();
      betPlayer.rewardDebt = data.getRewardDebt();
      betPlayer.autoCompound = data.getAutoCompound();
      betPlayer.lastUpdateTimestamp = data.getLastUpdateTimestamp();

      betPlayer.claims = betPlayer.claims.plus(item.reward);
      betPlayer.stakes = betPlayer.stakes.plus(item.reward);

      betPlayer.save();
    }

    // StakingPool
    updateStakingPool(chainId, betGame, event.address, ZERO_BIGINT);
  }
}

export function handleAutoCompoundSet(event: AutoCompoundSet): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const gameAddr = dataSource.context().get("betGame")!.toString();
  const betGame = getBetGame(chainId, Address.fromString(gameAddr));

  // StakingPlayer
  const contract = BetGameStaking.bind(event.address);
  const data = contract.stakes(item.user);
  const playerKey = `${betGame.id}_${player.id}`;
  let betPlayer = StakingPlayer.load(playerKey);
  if (betPlayer) {
    betPlayer.amount = data.getAmount();
    betPlayer.weightedAmount = data.getWeightedAmount();
    betPlayer.rewardDebt = data.getRewardDebt();
    betPlayer.autoCompound = data.getAutoCompound();
    betPlayer.lastUpdateTimestamp = data.getLastUpdateTimestamp();
    betPlayer.save();
  }

  // StakingPool
  updateStakingPool(chainId, betGame, event.address, ZERO_BIGINT);
}

export function handleFundsProvidedToBetGame(
  event: FundsProvidedToBetGame
): void {
  const item = event.params;
  const player = findOrCreateUser(item.user.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const betGame = getBetGame(chainId, item.game);
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let stake = StakingFundGame.load(key);
  if (!stake) {
    stake = new StakingFundGame(key);
    stake.chainId = chainId;
    stake.game = betGame.id;
    stake.player = player.id;
    stake.amount = item.amount;

    stake.createdAt = event.block.timestamp;
    stake.txHash = event.transaction.hash;

    stake.save();

    updateStakingPool(chainId, betGame, event.address, item.amount);
  }
}

function updateStakingPool(
  chainId: i32,
  betGame: BetGame,
  staking: Address,
  payout: BigInt
): void {
  const contract = BetGameStaking.bind(staking);
  const data = contract.pool();
  const key = `${chainId}_${staking.toHexString()}`;
  let pool = StakingPool.load(key);
  if (!pool) {
    pool = new StakingPool(key);
    pool.chainId = chainId;
    pool.game = betGame.id;
    pool.payout = ZERO_BIGINT;
  }
  pool.accumulatedRewardsPerShare = data.getAccumulatedRewardsPerShare();
  pool.totalStaked = data.getTotalStaked();
  pool.totalWeightedStake = data.getTotalWeightedStake();
  pool.totalRewardsReceived = data.getTotalRewardsReceived();
  pool.totalRewardsDistributed = data.getTotalRewardsDistributed();
  pool.apr = contract.getAPR();
  pool.lastUpdateTimestamp = data.getLastUpdateTimestamp();
  pool.payout = pool.payout.plus(payout);
  pool.save();
}
