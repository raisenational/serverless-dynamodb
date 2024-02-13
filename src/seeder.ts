import path from 'node:path';
import fs from 'node:fs';
import { BatchWriteItemCommandInput, BatchWriteItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommandInput, BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';

// DynamoDB has a 25 item limit in batch requests
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
const MAX_MIGRATION_CHUNK = 25;

type DynamoDBWriteFunction = {
  (params: BatchWriteCommandInput): Promise<BatchWriteCommandOutput>;
  (params: BatchWriteItemCommandInput): Promise<BatchWriteItemCommandOutput>;
};

/**
 * Writes a batch chunk of migration seeds to DynamoDB. DynamoDB has a limit on the number of
 * items that may be written in a batch operation.
 * @param {function} dynamodbWriteFunction The DynamoDB DocumentClient.batchWrite or DynamoDB.batchWriteItem function
 */
function writeSeedBatch(dynamodbWriteFunction: DynamoDBWriteFunction, tableName: string, seedValues: object[]) {
  const params = {
    RequestItems: {
      [tableName]: seedValues.map((seed) => ({
        PutRequest: {
          Item: seed,
        },
      })),
    },
  };
  return new Promise<void>((resolve, reject) => {
    // interval lets us know how much time we have burnt so far. This lets us have a backoff mechanism to try
    // again a few times in case the Database resources are in the middle of provisioning.
    function execute(interval: number) {
      setTimeout(async () => {
        try {
          await dynamodbWriteFunction(params);
          resolve();
        } catch (err) {
          if (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ResourceNotFoundException' && interval <= 5000) {
              execute(interval + 1000);
            } else if (err instanceof TypeError && err.message === "Cannot read properties of undefined (reading '0')") {
              reject(new Error(`Failed to seed items for the ${tableName} table because of an AWS library error. This usually means your \`rawsources\` seed files are invalid.`, { cause: err }));
            } else {
              reject(err);
            }
          }
        }
      }, interval);
    }
    execute(0);
  });
}

/**
 * Writes a seed corpus to the given database table
 * @param dynamodbWriteFunction The DynamoDB DocumentClient.batchWrite or DynamoDB.batchWriteItem function
 */
export async function writeSeeds(dynamodbWriteFunction: DynamoDBWriteFunction, tableName: string, seedValues: object[]) {
  if (!dynamodbWriteFunction) {
    throw new Error('dynamodbWriteFunction argument must be provided');
  }
  if (!tableName) {
    throw new Error('table name argument must be provided');
  }
  if (!seedValues) {
    throw new Error('seeds argument must be provided');
  }

  const seedChunks = chunk(seedValues, MAX_MIGRATION_CHUNK);
  await Promise.all(seedChunks.map((chunk) => writeSeedBatch(dynamodbWriteFunction, tableName, chunk)));
}

const chunk = <T>(input: T[], size: number): T[][] => {
  return input.reduce<T[][]>((arr, item, idx) => {
    return idx % size === 0
      ? [...arr, [item]]
      : [...arr.slice(0, -1), [...(arr.slice(-1)[0] ?? []), item]];
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
function getSeedsAtLocation(location: string) {
  // load the file
  const rawFile = fs.readFileSync(location, { encoding: 'utf-8' });

  // parse as JSON
  const parsed = safeParse(rawFile);
  if (parsed instanceof Error) {
    throw new Error(`Failed to parse JSON when reading seed file '${location}'`, parsed);
  }

  // ensure the output is an array
  const array: object[] = Array.isArray(parsed) ? parsed : [parsed];

  return array;
}

function safeParse(json: string): object | Error {
  try {
    return JSON.parse(json);
  } catch (err) {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }
}

/**
 * Locates seeds given a set of files to scrape
 * @param {string[]} sources The filenames to scrape for seeds
 * @returns {object[]} The items to seed
 */
export function locateSeeds(sources: string[], cwd: string = process.cwd()) {
  const locations = sources.map((source) => path.join(cwd, source));
  return locations.map((location) => {
    if (!fs.existsSync(location)) {
      throw new Error(`source file ${location} does not exist`);
    }
    return getSeedsAtLocation(location);
  }).flat(1);
}
