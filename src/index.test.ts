import {
  describe, test, expect, beforeAll,
} from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import ServerlessDynamoDBPlugin from './index';

import serverlessMock from './serverlessMock.test';

describe('Port function', () => {
  let plugin: ServerlessDynamoDBPlugin;
  beforeAll(async () => {
    plugin = new ServerlessDynamoDBPlugin(serverlessMock, { stage: 'test', region: 'test' });
  });

  test('Port should return number', () => {
    expect(typeof plugin.port).toBe('number');
  });

  test('Port value should be >= 0 and < 65536', () => {
    expect(plugin.port).toBeGreaterThanOrEqual(0);
    expect(plugin.port).toBeLessThan(65536);
  });
});

describe('dynamodbOptions', () => {
  test('should return raw and doc objects of right type', () => {
    const { raw, doc } = ServerlessDynamoDBPlugin.prototype.dynamodbOptions();
    expect(raw).toBeInstanceOf(DynamoDBClient);
    expect(doc).toBeInstanceOf(DynamoDBDocumentClient);
  });
});

describe('startHandler function', () => {
  test('should be a function', () => {
    expect(typeof ServerlessDynamoDBPlugin.prototype.startHandler).toBe('function');
  });
});

describe('createTable functon', () => {
  test('should be a function', () => {
    expect(typeof ServerlessDynamoDBPlugin.prototype.createTable).toBe('function');
  });
});
