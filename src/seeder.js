"use strict";
const path = require("node:path");
const fs = require("node:fs");

// DynamoDB has a 25 item limit in batch requests
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
const MAX_MIGRATION_CHUNK = 25;

/**
 * Writes a batch chunk of migration seeds to DynamoDB. DynamoDB has a limit on the number of
 * items that may be written in a batch operation.
 * @param {function} dynamodbWriteFunction The DynamoDB DocumentClient.batchWrite or DynamoDB.batchWriteItem function
 * @param {string} tableName The table name being written to
 * @param {any[]} seeds The migration seeds being written to the table
 */
function writeSeedBatch(dynamodbWriteFunction, tableName, seeds) {
  const params = {
    RequestItems: {
      [tableName]: seeds.map((seed) => ({
        PutRequest: {
          Item: seed,
        },
      })),
    },
  };
  return new Promise((resolve, reject) => {
    // interval lets us know how much time we have burnt so far. This lets us have a backoff mechanism to try
    // again a few times in case the Database resources are in the middle of provisioning.
    let interval = 0;
    function execute(interval) {
      setTimeout(() => dynamodbWriteFunction(params).catch((err) => {
        if (err) {
          if (err.code === "ResourceNotFoundException" && interval <= 5000) {
            execute(interval + 1000);
          } else {
            reject(err);
          }
        }
      }).then(() => resolve()), interval);
    }
    execute(interval);
  });
}

/**
 * Writes a seed corpus to the given database table
 * @param {function} dynamodbWriteFunction The DynamoDB DocumentClient.batchWrite or DynamoDB.batchWriteItem function
 * @param {string} tableName The table name
 * @param {any[]} seeds The seed values
 */
function writeSeeds(dynamodbWriteFunction, tableName, seeds) {
  if (!dynamodbWriteFunction) {
    throw new Error("dynamodbWriteFunction argument must be provided");
  }
  if (!tableName) {
    throw new Error("table name argument must be provided");
  }
  if (!seeds) {
    throw new Error("seeds argument must be provided");
  }

  if (seeds.length > 0) {
    const seedChunks = chunk(seeds, MAX_MIGRATION_CHUNK);
    return Promise.all(seedChunks.map((chunk) => writeSeedBatch(dynamodbWriteFunction, tableName, chunk)))
      .then(() => console.log("Seed running complete for table: " + tableName));
  }
}

const chunk = (input, size) => {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
};

/**
 * Scrapes seed files out of a given location. This file may contain
 * either a simple json object, or an array of simple json objects. An array
 * of json objects is returned.
 *
 * @param {string} location the filename to read seeds from.
 * @returns {object[]} json
 */
function getSeedsAtLocation(location) {
  // load the file as JSON
  const result = require(location);

  // Ensure the output is an array
  const array = Array.isArray(result) ? result : [result];

  return array;
}

/**
 * Locates seeds given a set of files to scrape
 * @param {string[]} sources The filenames to scrape for seeds
 * @returns {object[]} The items to seed
 */
function locateSeeds(sources, cwd) {
  sources = sources || [];
  cwd = cwd || process.cwd();

  const locations = sources.map((source) => path.join(cwd, source));
  return locations.map((location) => {
    if(!fs.existsSync(location)) {
      throw new Error("source file " + location + " does not exist");
    }
    return getSeedsAtLocation(location);
  }).flat(1);
}

module.exports = { writeSeeds, locateSeeds };
