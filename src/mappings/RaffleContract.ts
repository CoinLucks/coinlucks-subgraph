import { BigInt, dataSource, ByteArray, ipfs } from "@graphprotocol/graph-ts";

import {
  ZERO_ADDRESS,
  ZERO_BIGINT,
  findOrCreateUser,
  formatEth,
  formatWeiToNumber,
  getIpfsCID,
} from "../utils";

import {
  Raffle,
  RaffleEligibility,
  RaffleActivity,
  RaffleCancelEvent,
  RaffleCloseEvent,
  RaffleEndEvent,
  UserReferralReward,
  RafflePrize,
  RaffleParticipant,
  RaffleTicket,
  UserReferrerIncome,
  Token,
} from "../../generated/schema";
import { TokenContract } from "../../generated/RaffleContract/TokenContract";
import {
  RaffleContract,
  RaffleCancelled,
  RaffleClosed,
  RaffleCreated,
  RaffleEnded,
  BuyTicket,
  TransferTickets,
  ReferralReward,
  DistributeFee,
  TransferFund,
  TransferPrize,
  RaffleContract__prizesResult,
} from "../../generated/RaffleContract/RaffleContract";
import { handleTokenMetadata } from "./TokenMetadata";
import { PlayType } from "../types";

enum STATUS {
  PENDING, // raffle created but not start
  OPEN, // the seller stakes the cryptos for the raffle
  CLOSE, // raffle close, and request VRF to draw
  END, // the raffle is finished, and NFT and funds were transferred
  CANCEL, // operator asks to cancel the raffle. Players has 30 days to ask for a refund
}

enum PRIZE_TYPE {
  NATIVE, // native token
  TOKEN, // ERC20
  NFT, // ERC721/ERC1155
}

const blackLists = [""];

export function handleRaffleCreated(event: RaffleCreated): void {
  const item = event.params;
  const raffleId = item.raffleId;
  const seller = item.seller.toHexString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;

  if (blackLists.includes(seller)) {
    return;
  }

  findOrCreateUser(seller);

  let raffle = Raffle.load(key);
  if (!raffle) {
    raffle = new Raffle(key);

    // read on-chain data
    const contract = RaffleContract.bind(event.address);
    const data = contract.raffles(raffleId);
    const prize = contract.prizes(raffleId);

    // update info
    raffle.raffleId = raffleId;
    raffle.status = STATUS.OPEN;

    raffle.hasFree = data.getHasFree();
    raffle.seller = seller;
    raffle.chainId = chainId;

    raffle.platformFee = data.getPlatformFee().toI32();
    raffle.maxPerUser = data.getMaxPerUser().toI32();

    raffle.startTime = event.block.timestamp;
    raffle.endTime = data.getEndTime();
    raffle.cancelTime = null;
    raffle.closeTime = null;
    raffle.finishTime = null;

    raffle.seller = seller;
    raffle.winner = ZERO_ADDRESS;

    raffle.title = "";
    raffle.note = item.note;
    raffle.image = "";

    raffle.price = data.getPrice();

    raffle.ticketsCount = 0;
    raffle.ticketsFree = 0;
    raffle.participants = 0;
    raffle.participantsFree = 0;

    raffle.amountRaised = ZERO_BIGINT;
    raffle.amountCollected = ZERO_BIGINT;
    raffle.randomNumber = 0;

    raffle.createdAt = event.block.timestamp;
    raffle.txHash = event.transaction.hash;

    saveTokenMetadata(chainId, raffle, prize);

    // prize
    saveRafflePrize(chainId, raffle, prize);

    // eligibility
    saveRaffleEligibility(raffle, contract, data.getEligibility());

    raffle.save();
  }
}

function saveTokenMetadata(
  chainId: i32,
  raffle: Raffle,
  prize: RaffleContract__prizesResult
): void {
  const key = `${chainId}_${prize.getToken().toHexString()}`;

  switch (prize.getPrizeType()) {
    case PRIZE_TYPE.NATIVE:
      raffle.category = "crypto";
      const symbol = dataSource.context().get("symbol")!.toString();
      raffle.title = `${formatEth(prize.getAmount())} ${symbol}`;
      break;
    case PRIZE_TYPE.TOKEN:
      {
        raffle.category = "crypto";

        let token = Token.load(key);
        if (!token) {
          const tokenContract = TokenContract.bind(prize.getToken());
          if (tokenContract) {
            const name = tokenContract.try_name();
            const symbol = tokenContract.try_symbol();
            const decimals = tokenContract.try_decimals();

            token = new Token(key);
            token.chainId = chainId;
            token.address = prize.getToken().toHexString();
            token.name = name.reverted ? "" : name.value;
            token.symbol = symbol.reverted ? "" : symbol.value;
            token.decimals = decimals.reverted ? 18 : decimals.value;
            token.save();
          }
        }
        if (token) {
          raffle.token = token.id;
          raffle.title = `${formatWeiToNumber(
            prize.getAmount(),
            token.decimals
          )} ${token.symbol ? token.symbol! : token.name ? token.name! : ""}`;
        }
      }
      break;
    case PRIZE_TYPE.NFT:
      {
        raffle.category = "nft";

        let token = Token.load(key);
        if (!token) {
          const tokenContract = TokenContract.bind(prize.getToken());
          if (tokenContract) {
            const name = tokenContract.try_name();
            const symbol = tokenContract.try_symbol();
            const tokenURI = tokenContract.try_tokenURI(prize.getTokenId());

            token = new Token(key);
            token.chainId = chainId;
            token.address = prize.getToken().toHexString();
            token.name = name.reverted ? "" : name.value;
            token.symbol = symbol.reverted ? "" : symbol.value;
            token.tokenId = prize.getTokenId();

            if (!tokenURI.reverted) {
              const cid = getIpfsCID(tokenURI.value);
              token.tokenURI = tokenURI.value;
              token.metadata = cid;

              const json = ipfs.cat(cid);
              if (json) {
                handleTokenMetadata(cid, json);
              }
            }
            token.save();
          }
        }
        if (token) {
          raffle.token = token.id;
          raffle.title = token.name ? token.name! : "";
        }
      }
      break;
  }
}

function saveRafflePrize(
  chainId: i32,
  raffle: Raffle,
  data: RaffleContract__prizesResult
): void {
  let prize = RafflePrize.load(raffle.id);
  if (!prize) {
    prize = new RafflePrize(raffle.id);
    prize.raffle = raffle.id;
    prize.prizeType = data.getPrizeType();
    prize.token = data.getToken();
    prize.amount = data.getAmount();
    prize.tokenId = data.getTokenId();
    prize.save();
  }
}

function saveRaffleEligibility(
  raffle: Raffle,
  contract: RaffleContract,
  count: BigInt
): void {
  for (let i = 0; i < count.toI32(); i++) {
    const data = contract.try_eligibilities(raffle.raffleId, BigInt.fromI32(i));
    if (data && !data.reverted) {
      const key = `${raffle.id}_${i}`;
      let elg = RaffleEligibility.load(key);
      if (!elg) {
        elg = new RaffleEligibility(key);
        elg.raffle = raffle.id;
        elg.token = data.value.getToken();
        elg.tokenId = data.value.getTokenId();
        elg.amount = data.value.getAmount();
        elg.save();
      }
    } else {
      break;
    }
  }
}

export function handleRaffleCancelled(event: RaffleCancelled): void {
  const raffleId = event.params.raffleId.toString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;

  let raffle = Raffle.load(key);
  if (raffle) {
    let evt = RaffleCancelEvent.load(raffle.id);
    if (!evt) {
      evt = new RaffleCancelEvent(raffle.id);
      evt.raffle = raffle.id;
      evt.seller = raffle.seller;
      evt.createdAt = event.block.timestamp;
      evt.txHash = event.transaction.hash;
      evt.save();

      // update raffle
      raffle.status = STATUS.CANCEL;
      raffle.cancelTime = event.block.timestamp;
      raffle.save();
    }
  }
}

export function handleRaffleColsed(event: RaffleClosed): void {
  const raffleId = event.params.raffleId.toString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;

  let raffle = Raffle.load(key);
  if (raffle) {
    let evt = RaffleCloseEvent.load(raffle.id);
    if (!evt) {
      evt = new RaffleCloseEvent(raffle.id);
      evt.raffle = raffle.id;
      evt.caller = event.params.caller.toHexString();
      evt.createdAt = event.block.timestamp;
      evt.txHash = event.transaction.hash;
      evt.save();

      // read on-chain data
      const contract = RaffleContract.bind(event.address);
      // update raffle
      raffle.status = contract.raffles(raffle.raffleId).getStatus();
      raffle.closeTime = event.block.timestamp;
      raffle.save();
    }
  }
}

export function handleBuyTicket(event: BuyTicket): void {
  const item = event.params;
  const raffleId = item.raffleId;
  const user = item.user.toHexString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;

  let raffle = Raffle.load(key);
  if (raffle) {
    findOrCreateUser(user);

    // read on-chain data
    const contract = RaffleContract.bind(event.address);
    const data = contract.raffles(raffleId);

    // update raffle
    raffle.amountCollected = data.getAmountCollected();
    raffle.amountRaised = data.getAmountRaised();
    raffle.ticketsCount = data.getTicketsCount().toI32();
    raffle.ticketsFree += event.transaction.value.gt(ZERO_BIGINT)
      ? 0
      : item.num.toI32();
    raffle.participants += 1;
    raffle.participantsFree += event.transaction.value.gt(ZERO_BIGINT) ? 0 : 1;

    raffle.save();

    // RaffleActivity
    const activityKey = `${key}_${event.params.ticketId}`;
    let activity = RaffleActivity.load(activityKey);
    if (!activity) {
      activity = new RaffleActivity(activityKey);
      activity.raffle = raffle.id;
      activity.user = user;
      activity.ticketId = event.params.ticketId;
      activity.ticketCount = event.params.num;
      activity.currentSize = event.params.currentSize;
      activity.cost = event.transaction.value;
      activity.note = event.params.note;
      activity.createdAt = event.block.timestamp;
      activity.txHash = event.transaction.hash;
      activity.save();
    }

    // RaffleParticipant
    let participantKey = `${key}_${user}`;
    let participant = RaffleParticipant.load(participantKey);
    if (!participant) {
      participant = new RaffleParticipant(participantKey);
      participant.raffle = raffle.id;
      participant.user = user;
      participant.ticketCount = ZERO_BIGINT;
      participant.cost = ZERO_BIGINT;
    }
    participant.ticketCount = participant.ticketCount.plus(event.params.num);
    participant.cost = participant.cost.plus(event.transaction.value);
    participant.save();

    // RaffleTicket
    const ticketKey = `${key}_${event.params.ticketId}`;
    let ticket = RaffleTicket.load(ticketKey);
    if (!ticket) {
      ticket = new RaffleTicket(ticketKey);
      ticket.raffle = raffle.id;
      ticket.user = user;
      ticket.ticketId = event.params.ticketId;
      ticket.ticketCount = event.params.num;
      ticket.currentSize = event.params.currentSize;
      ticket.cost = event.transaction.value;
      ticket.createdAt = event.block.timestamp;
      ticket.txHash = event.transaction.hash;
      ticket.save();
    }
  }
}

export function handleRaffleEnded(event: RaffleEnded): void {
  const raffleId = event.params.raffleId.toString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;
  let raffle = Raffle.load(key);
  if (raffle) {
    let evt = RaffleEndEvent.load(raffleId);
    if (!evt) {
      evt = new RaffleEndEvent(raffleId);
      evt.raffle = raffle.id;
      evt.winner = event.params.winner.toHexString();
      evt.number = event.params.randomNumber;
      evt.createdAt = event.block.timestamp;
      evt.txHash = event.transaction.hash;
      evt.save();

      // update raffle
      raffle.status = STATUS.END;
      raffle.randomNumber = evt.number.toI32();
      raffle.finishTime = event.block.timestamp;
      raffle.winner = evt.winner;
      raffle.save();
    }
  }
}

export function handleReferralReward(event: ReferralReward): void {
  const raffleId = event.params.raffleId.toString();
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${raffleId}`;
  let raffle = Raffle.load(key);
  if (raffle) {
    const paidKey = ByteArray.fromUTF8(
      `${key}_${event.transaction.hash.toHexString()}_${event.params.referrer.toHexString()}`
    ).toHexString();
    let evt = UserReferralReward.load(paidKey);
    if (!evt) {
      evt = new UserReferralReward(paidKey);
      evt.chainId = chainId;
      evt.playType = PlayType.Raffles;
      evt.key = raffle.id;
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

export function handleTransferTickets(event: TransferTickets): void {}

export function handleDistributeFee(event: DistributeFee): void {}

export function handleTransferFund(event: TransferFund): void {}

export function handleTransferPrize(event: TransferPrize): void {}
