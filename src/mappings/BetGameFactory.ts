import {
  dataSource,
  DataSourceContext,
  DataSourceTemplate,
  log,
} from "@graphprotocol/graph-ts";

import { BetGame } from "../../generated/schema";
import { GameAdded } from "../../generated/BetGameFactory/BetGameFactory";
import { ZERO_ADDRESS } from "../utils";

export function handleGameAdded(event: GameAdded): void {
  const chainId = dataSource.context().get("chainId")!.toI32();
  const key = `${chainId}_${event.params.addr.toHexString()}`;

  let betGame = BetGame.load(key);
  if (!betGame) {
    betGame = new BetGame(key);
    betGame.chainId = chainId;
    betGame.playType = event.params.playType;
    betGame.name = event.params.name;
    betGame.address = event.params.addr;
    betGame.staking = event.params.staking;
    betGame.save();

    let context = new DataSourceContext();
    context.setI32("chainId", chainId);

    DataSourceTemplate.createWithContext(
      "BetGame",
      [event.params.addr.toHexString()],
      context
    );

    if (event.params.staking.toHexString() != ZERO_ADDRESS) {
      context.setString("betGame", event.params.addr.toHexString());

      DataSourceTemplate.createWithContext(
        "BetGameStaking",
        [event.params.staking.toHexString()],
        context
      );
    }
  }
}
