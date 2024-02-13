import Serverless from 'serverless';
import { test } from 'vitest';

test.skip('this is just used to store the serverless mock');

const serverlessMock = {
  service: {
    custom: {
      dynamodb: {
        port: 8000,
        stages: ['test'],
        seed: {
          test: {
            sources: [{
              table: 'person-table',
              sources: ['./test-resources/persons.sources.json'],
            }, {
              table: 'building-table',
              rawsources: ['./test-resources/buildings.rawsources.json'],
            }],
          },
        },
      },
    },
    resources: {
      Resources: {
        personTable: {
          Type: 'AWS::DynamoDB::Table',
          Properties: {
            TableName: 'person-table',
            AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
            KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
            ProvisionedThroughput: {
              ReadCapacityUnits: 1,
              WriteCapacityUnits: 1,
            },
          },
        },
        buildingTable: {
          Type: 'AWS::DynamoDB::Table',
          Properties: {
            TableName: 'building-table',
            AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
            KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
            ProvisionedThroughput: {
              ReadCapacityUnits: 1,
              WriteCapacityUnits: 1,
            },
          },
        },
      },
    },

  },
  cli: {
    log: () => { },
  },
} as unknown as Serverless;

export default serverlessMock;
