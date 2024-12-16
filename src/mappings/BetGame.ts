import {
  Address,
  BigInt,
  ByteArray,
  dataSource,
} from "@graphprotocol/graph-ts";

import {
  BetGame,
  Bet,
  BetGameClaim,
  UserReferralReward,
  UserReferrerIncome,
  BetGamePlayer,
} from "../../generated/schema";
import {
  BetGame as BetGameContract,
  BetPlaced,
  BetResult,
  Claim,
  ReferralReward,
} from "../../generated/templates/BetGame/BetGame";
import { CoinFlip } from "../../generated/templates/BetGame/CoinFlip";
import { DiceShake } from "../../generated/templates/BetGame/DiceShake";
import { Scratch69 } from "../../generated/templates/BetGame/Scratch69";
import { findOrCreateUser, getBetGame, ZERO_BIGINT } from "../utils";
import { BetGameName } from "../types";

enum BetStatus {
  Pending,
  Won,
  Lost,
}

export function handleBetPlaced(event: BetPlaced): void {
  const item = event.params;
  const betId = item.betId;
  const chainId = dataSource.context().get("chainId")!.toI32();

  const betGame = getBetGame(chainId, event.address);
  const key = `${chainId}_${event.address.toHexString()}_${betId}`;

  const player = findOrCreateUser(item.player.toHexString());

  let bet = Bet.load(key);
  if (!bet) {
    bet = new Bet(key);
    bet.chainId = chainId;
    bet.game = betGame.id;

    bet.betId = betId;

    bet.player = player.id;
    bet.betAmount = item.betAmount;
    bet.betStatus = BetStatus.Pending;
    bet.payout = ZERO_BIGINT;
    bet.jackpot = ZERO_BIGINT;
    bet.streakBonus = ZERO_BIGINT;
    bet.note = item.note;

    bet.createdAt = event.block.timestamp;
    bet.txHash = event.transaction.hash;

    addBetExts(bet, betGame, event.address);

    bet.save();
  }
}

export function handleBetResult(event: BetResult): void {
  const item = event.params;
  const betId = item.betId;
  const chainId = dataSource.context().get("chainId")!.toI32();
  const betGame = getBetGame(chainId, event.address);
  const key = `${chainId}_${event.address.toHexString()}_${betId}`;
  let bet = Bet.load(key);
  if (bet) {
    bet.betStatus = item.won == true ? BetStatus.Won : BetStatus.Lost;
    bet.payout = item.payout;
    bet.jackpot = item.jackpot;
    bet.streakBonus = item.streakBonus;
    bet.drawNumbers = item.drawResults;

    bet.closeAt = event.block.timestamp;
    bet.closeTx = event.transaction.hash;

    updateBetExts(bet, betGame, event.address);

    bet.save();

    // BetGamePlayer
    const contract = BetGameContract.bind(event.address);
    const data = contract.players(item.player);
    const playerKey = `${betGame.id}_${item.player.toHexString()}`;
    let betPlayer = BetGamePlayer.load(playerKey);
    if (!betPlayer) {
      betPlayer = new BetGamePlayer(playerKey);
      betPlayer.chainId = chainId;
      betPlayer.game = betGame.id;
      betPlayer.player = bet.player;
      betPlayer.playCount = 0;
      betPlayer.winCount = 0;
      betPlayer.LossCount = 0;
      betPlayer.payouts = ZERO_BIGINT;
      betPlayer.playAmounts = ZERO_BIGINT;
    }
    betPlayer.winnings = data.getWinnings();
    betPlayer.claims = data.getClaims();
    betPlayer.lastBetAmount = data.getLastBetAmount();
    betPlayer.winStreak = data.getWinStreak();
    betPlayer.loseStreak = data.getLoseStreak();

    betPlayer.playCount++;
    if (item.won) {
      betPlayer.winCount++;
    } else {
      betPlayer.LossCount++;
    }
    betPlayer.playAmounts = betPlayer.playAmounts!.plus(bet.betAmount);
    betPlayer.payouts = betPlayer
      .payouts!.plus(item.payout)
      .plus(item.jackpot)
      .plus(item.streakBonus);

    betPlayer.save();
  }
}

function addBetExts(bet: Bet, betGame: BetGame, address: Address): void {
  if (betGame.name == BetGameName.CoinFlip) {
    const betExt = CoinFlip.bind(address).betExts(bet.betId);
    bet.betType = betExt.getBetType();
    bet.multiplier = betExt.getMultiplier();
  }

  if (betGame.name == BetGameName.DiceShake) {
    const betExt = DiceShake.bind(address).betExts(bet.betId);
    bet.betType = betExt.getBetType();
    bet.multiplier = betExt.getMultiplier();
    bet.betNumber = betExt.getBetNumber();
    bet.rangeEnd = betExt.getRangeEnd();
    bet.isOver = betExt.getIsOver();
  }

  if (betGame.name == BetGameName.Scratch69) {
  }
}

function updateBetExts(bet: Bet, betGame: BetGame, address: Address): void {
  if (betGame.name == BetGameName.CoinFlip) {
  }

  if (betGame.name == BetGameName.DiceShake) {
  }

  if (betGame.name == BetGameName.Scratch69) {
    const contract = Scratch69.bind(address);

    bet.betPrize = contract.betPrizes(bet.betId);
    bet.multiplier = contract.prizeOdds(bet.betPrize);
  }
}

export function handleClaim(event: Claim): void {
  const item = event.params;
  const player = findOrCreateUser(item.sender.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();

  const betGame = getBetGame(chainId, event.address);
  const key = `${chainId}_${event.transaction.hash.toHexString()}`;

  let claim = BetGameClaim.load(key);
  if (!claim) {
    claim = new BetGameClaim(key);
    claim.chainId = chainId;
    claim.game = betGame.id;
    claim.player = player.id;
    claim.value = item.value;
    claim.poolAmt = item.poolAmt;

    claim.createdAt = event.block.timestamp;
    claim.txHash = event.transaction.hash;

    claim.save();

    // BetGamePlayer
    const contract = BetGameContract.bind(event.address);
    const data = contract.players(item.sender);
    const playerKey = `${betGame.id}_${player.id}`;
    let betPlayer = BetGamePlayer.load(playerKey);
    if (betPlayer) {
      betPlayer.claims = data.getClaims();
      betPlayer.save();
    }
  }
}

export function handleReferralReward(event: ReferralReward): void {
  const betId = event.params.betId.toString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const betGame = getBetGame(chainId, event.address);

  const key = `${chainId}_${event.address.toHexString()}_${betId}`;
  let bet = Bet.load(key);

  if (bet) {
    const paidKey = ByteArray.fromUTF8(
      `${key}_${event.transaction.hash.toHexString()}_${event.params.referrer.toHexString()}`
    ).toHexString();
    let evt = UserReferralReward.load(paidKey);
    if (!evt) {
      evt = new UserReferralReward(paidKey);
      evt.chainId = chainId;
      evt.playType = betGame.name;
      evt.key = bet.id;
      evt.user = event.params.user.toHexString(); // buyer
      evt.referrer = event.params.referrer.toHexString(); // cashback reciever
      evt.value = event.params.value; // ticket payment
      evt.amount = event.params.amount; // cashback amount
      evt.createdAt = event.block.timestamp;
      evt.txHash = event.transaction.hash;
      evt.save();

      // update referrer income
      const referrer = findOrCreateUser(evt.referrer);
      if (referrer) {
        const incomeKey = `${chainId}_${referrer.id}`;
        let referrerIncome = UserReferrerIncome.load(incomeKey);
        if (!referrerIncome) {
          referrerIncome = new UserReferrerIncome(incomeKey);
          referrerIncome.chainId = chainId;
          referrerIncome.user = referrer.id;
          referrerIncome.amount = evt.amount;
          referrerIncome.save();
        } else {
          referrerIncome.amount = referrerIncome.amount.plus(evt.amount);
          referrerIncome.save();
        }
      }
    }
  }
}
