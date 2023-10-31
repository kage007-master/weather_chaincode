/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

const weatherChain = require("./lib/weather_chain");

module.exports.WeatherChain = weatherChain;
module.exports.contracts = [weatherChain];
