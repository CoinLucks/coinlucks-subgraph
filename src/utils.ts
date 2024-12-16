import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BetGame, User } from "../generated/schema";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_BIGINT = BigInt.fromI32(0);
export const ONE_BIGINT = BigInt.fromI32(1);

/**
 * Find or Create a User entity with `id` and return it
 * @param id
 */
export function findOrCreateUser(id: string): User {
  let user = User.load(id);

  if (user == null) {
    user = new User(id);
    user.save();
  }

  return user;
}

export function formatWeiToNumber(wei: BigInt, decimals: i32): string {
  let eth = wei.toBigDecimal().div(
    BigInt.fromI32(10)
      .pow(decimals as u8)
      .toBigDecimal()
  );
  return eth.toString();
}

export function formatEth(wei: BigInt): string {
  return formatWeiToNumber(wei, 18);
}

export function getIpfsCID(url: string): string {
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "");
  } else if (url.indexOf("/ipfs/") > 0) {
    return url.substring(url.indexOf("/ipfs/") + 6, url.length);
  }
  return url;
}

export function getIpfsUrl(url: string): string {
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
}

export function getBetGame(chainId: i32, addr: Address): BetGame {
  return BetGame.load(`${chainId}_${addr.toHexString()}`)!;
}
