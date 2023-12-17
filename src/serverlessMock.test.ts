import Serverless from 'serverless';
import { test } from 'vitest';

test.skip('this is just used to store the serverless mock');

const serverlessMock = {
  service: {
    custom: {
      dynamodb: {
        port: 8000,
        stages: ['test'],
      },
    },
  },
  cli: {
    log: () => { },
  },
} as unknown as Serverless;

export default serverlessMock;
