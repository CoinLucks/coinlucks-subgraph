import { dataSource } from "@graphprotocol/graph-ts";

import { findOrCreateUser } from "../utils";

import { UserReferrer } from "../../generated/schema";

import { BindReferrer } from "../../generated/Referral/Referral";

export function handleBindReferrer(event: BindReferrer): void {
  const user = findOrCreateUser(event.params.user.toHexString());
  const referrer = findOrCreateUser(event.params.referrer.toHexString());
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${user.id}`;
  const key2 = `${chainId}_${referrer.id}`;

  if (user) {
    user.referrer = referrer.id;
    user.save();
  }

  let ref2 = UserReferrer.load(key2);
  let evt = UserReferrer.load(key);
  if (!evt) {
    evt = new UserReferrer(key);
    evt.chainId = chainId;
    evt.user = user.id;
    evt.referrer = referrer.id; // cashback reciever
    evt.referrer2 = ref2 ? ref2.referrer : null;
    evt.createdAt = event.block.timestamp;
    evt.txHash = event.transaction.hash;
    evt.save();
  }
}
