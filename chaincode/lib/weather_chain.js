/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

// Deterministic JSON.stringify()
const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");

class WeatherChain extends Contract {
  async CreateAcounnt(ctx, id) {
    const exists = await this.AssetExists(ctx, id);
    if (exists) {
      throw new Error(`The asset ${id} already exists`);
    }
    const asset = {
      ID: id,
      balance: 1000,
      type: "account",
    };
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    return JSON.stringify(asset);
  }

  async CreateClaim(ctx, id, weather, weatherEventID, clientID, date) {
    const exists = await this.AssetExists(ctx, id);
    if (exists) {
      throw new Error(`The asset ${id} already exists`);
    }
    const asset = {
      ID: id,
      weather,
      weatherEventID,
      clientID,
      date,
      type: "claim",
    };
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    return JSON.stringify(asset);
  }

  async CreateEvent(ctx, id, weather, city, date, raised) {
    const exists = await this.AssetExists(ctx, id);
    if (exists) {
      throw new Error(`The asset ${id} already exists`);
    }
    const asset = {
      ID: id,
      weather,
      city,
      date,
      status: "Active",
      raised: Number(raised),
      confirmed: 0,
      type: "event",
    };
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    return JSON.stringify(asset);
  }

  // ReadAsset returns the asset stored in the world state with given id.
  async ReadAsset(ctx, id) {
    const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
    if (!assetJSON || assetJSON.length === 0) {
      throw new Error(`The asset ${id} does not exist`);
    }
    return assetJSON.toString();
  }

  // UpdateAsset updates an existing asset in the world state with provided parameters.
  async ConfirmDamage(ctx, id) {
    const assetString = await this.ReadAsset(ctx, id);
    const asset = JSON.parse(assetString);
    asset.confirmed++;
    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    return asset.confirmed;
  }

  async EndEvents(ctx) {
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record;
      try {
        record = JSON.parse(strValue);
        if (record.status === "Active") {
          record.status = "Ended";
          await ctx.stub.putState(
            record.ID,
            Buffer.from(stringify(sortKeysRecursive(record)))
          );
        }
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      result = await iterator.next();
    }
    return "done";
  }

  // AssetExists returns true when asset with given ID exists in world state.
  async AssetExists(ctx, id) {
    const assetJSON = await ctx.stub.getState(id);
    return assetJSON && assetJSON.length > 0;
  }

  // TransferAsset updates the owner field of asset with given id in the world state.
  async TransferAsset(ctx, id, amount, date) {
    const assetString = await this.ReadAsset(ctx, id);
    const asset = JSON.parse(assetString);
    asset.balance -= Number(amount);
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    let txid = 0;
    const exists = await this.AssetExists(ctx, "tx_cnt");
    if (exists) {
      txid = Number(await ctx.stub.getState("tx_cnt"));
    }
    const transaction = {
      ID: txid.toString(),
      clientID: id,
      amount,
      date,
      type: "transaction",
    };
    await ctx.stub.putState(
      "transaction" + txid.toString(),
      Buffer.from(stringify(sortKeysRecursive(transaction)))
    );
    await ctx.stub.putState("tx_cnt", Buffer.from((txid + 1).toString()));
    return txid;
  }

  // GetAllAssets returns all assets found in the world state.
  async GetAllAccounts(ctx) {
    const allResults = [];
    // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record;
      try {
        record = JSON.parse(strValue);
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      if (record.type === "account") allResults.push(record);
      result = await iterator.next();
    }
    return JSON.stringify(allResults);
  }

  async GetAllEvents(ctx, active) {
    const allResults = [];
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record;
      try {
        record = JSON.parse(strValue);
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      if (
        record.type === "event" &&
        (active === "false" || record.status !== "Ended")
      )
        allResults.push(record);
      result = await iterator.next();
    }
    return JSON.stringify(allResults);
  }

  async GetTransactions(ctx, id) {
    const allResults = [];
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record;
      try {
        record = JSON.parse(strValue);
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      if (
        record.type === "transaction" &&
        (id === "" || record.clientID === id)
      )
        allResults.push(record);
      result = await iterator.next();
    }
    return JSON.stringify(allResults);
  }
}

module.exports = WeatherChain;
