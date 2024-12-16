import { json, Bytes, dataSource } from "@graphprotocol/graph-ts";

import { TokenMetadata } from "../../generated/schema";
import { getIpfsUrl } from "../utils";

export function handleMetadata(content: Bytes): void {
  let tokenMetadata = new TokenMetadata(dataSource.stringParam());
  const value = json.fromBytes(content).toObject();
  if (value) {
    const image = value.get("image");
    const name = value.get("name");
    const description = value.get("description");

    tokenMetadata.name = name ? name.toString() : "";
    tokenMetadata.image = image ? getIpfsUrl(image.toString()) : "";
    tokenMetadata.description = description ? description.toString() : "";
    tokenMetadata.save();
  }
}

export function handleTokenMetadata(cid: string, content: Bytes): void {
  let tokenMetadata = new TokenMetadata(cid);
  const value = json.fromBytes(content).toObject();
  if (value) {
    const image = value.get("image");
    const name = value.get("name");
    const description = value.get("description");

    tokenMetadata.name = name ? name.toString() : "";
    tokenMetadata.image = image ? getIpfsUrl(image.toString()) : "";
    tokenMetadata.description = description ? description.toString() : "";
    tokenMetadata.save();
  }
}
