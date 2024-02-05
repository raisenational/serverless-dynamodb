import {
  test, expect, beforeAll, afterAll,
} from 'vitest';
import {
  CreateTableCommand, DynamoDBClient, ListTablesCommand, PutItemCommand, ScanCommand,
} from '@aws-sdk/client-dynamodb';
import ServerlessDynamoDBPlugin from './index';
import serverlessMock from './serverlessMock.test';

const client = new DynamoDBClient({
  region: 'localhost',
  endpoint: 'http://0.0.0.0:8000',
  credentials: {
    accessKeyId: 'MockAccessKeyId',
    secretAccessKey: 'MockSecretAccessKey',
  },
});

const testTableName = 'serverless-dynamodb-test-things';
const testItem = {
  id: { S: 'thing_123' },
  name: { S: 'example string' },
};

let plugin: ServerlessDynamoDBPlugin;

beforeAll(async () => {
  plugin = new ServerlessDynamoDBPlugin(serverlessMock, { stage: 'test', region: 'test' });
  await plugin.installHandler();
  await plugin.startHandler();
}, 30_000);

test('create and list tables, add and scan items', async () => {
  await client.send(new CreateTableCommand({
    AttributeDefinitions: [{
      AttributeName: 'id',
      AttributeType: 'S',
    }],
    KeySchema: [{
      AttributeName: 'id',
      KeyType: 'HASH',
    }],
    TableName: testTableName,
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  }));

  const tables = await client.send(new ListTablesCommand({}));
  expect(tables.TableNames).toEqual([testTableName]);

  await client.send(new PutItemCommand({
    TableName: testTableName,
    Item: testItem,
  }));

  const items = await client.send(new ScanCommand({ TableName: testTableName }));
  expect(items?.Items).toHaveLength(1);
  expect(items.Items![0]).toEqual(testItem);
});

afterAll(async () => {
  await plugin.endHandler();
});
