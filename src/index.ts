/* eslint-disable @typescript-eslint/dot-notation */
import {
  DynamoDBClient, CreateTableCommand, BatchWriteItemCommand, CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import * as dynamodbLocal from 'aws-dynamodb-local';
import type Serverless from 'serverless';
import type Plugin from 'serverless/classes/Plugin';
import path from 'node:path';
import type Aws from 'serverless/plugins/aws/provider/awsProvider';
import type { CloudFormationResource } from 'serverless/plugins/aws/provider/awsProvider';
import { Config, SeedConfig } from './config';
import { locateSeeds, writeSeeds } from './seeder';

const PLUGIN_NAME = 'serverless-dynamodb';

class ServerlessDynamoDBPlugin implements Plugin {
  readonly hooks: Record<string, () => Promise<unknown>>;

  readonly commands: Plugin.Commands;

  readonly provider = 'aws';

  private readonly config: Config;

  private readonly options:
  & Serverless.Options
  & Parameters<typeof dynamodbLocal.start>[0]
  & { localPath: string, noStart?: string, seed?: boolean, migrate?: boolean }
  & Record<string, string | string[] | boolean | unknown>;

  constructor(private serverless: Serverless, options: Serverless.Options) {
    this.config = this.serverless.service?.custom?.[PLUGIN_NAME]
        ?? this.serverless.service?.custom?.['dynamodb']
        ?? {};
    this.options = {
      localPath: path.resolve(...[serverless?.config?.servicePath, '.dynamodb'].filter((p) => typeof p === 'string')),
      ...options,
    };
    this.commands = {
      dynamodb: {
        commands: {
          migrate: {
            lifecycleEvents: ['migrateHandler'],
            usage: 'Creates local DynamoDB tables from the current Serverless configuration',
          },
          seed: {
            lifecycleEvents: ['seedHandler'],
            usage: 'Seeds local DynamoDB tables with data',
            options: {
              online: {
                shortcut: 'o',
                usage: 'Will connect to the tables online to do an online seed run',
                type: 'boolean',
              },
              seed: {
                shortcut: 's',
                usage: 'After starting and migrating dynamodb local, injects seed data into your tables. The --seed option determines which data categories to onload.',
                type: 'string',
              },
            },
          },
          start: {
            lifecycleEvents: ['startHandler'],
            usage: 'Starts local DynamoDB',
            options: {
              port: {
                shortcut: 'p',
                usage: 'The port number that DynamoDB will use to communicate with your application. If you do not specify this option, the default port is 8000',
                type: 'string',
              },
              cors: {
                shortcut: 'c',
                usage: 'Enable CORS support (cross-origin resource sharing) for JavaScript. You must provide a comma-separated "allow" list of specific domains. The default setting for -cors is an asterisk (*), which allows public access.',
                type: 'string',
              },
              inMemory: {
                shortcut: 'i',
                usage: 'DynamoDB; will run in memory, instead of using a database file. When you stop DynamoDB;, none of the data will be saved. Note that you cannot specify both -dbPath and -inMemory at once.',
                type: 'boolean',
              },
              dbPath: {
                shortcut: 'd',
                usage: 'The directory where DynamoDB will write its database file. If you do not specify this option, the file will be written to the current directory. Note that you cannot specify both -dbPath and -inMemory at once. For the path, current working directory is <projectroot>/node_modules/serverless-dynamodb-local/dynamob. For example to create <projectroot>/node_modules/serverless-dynamodb-local/dynamob/<mypath> you should specify -d <mypath>/ or --dbPath <mypath>/ with a forwardslash at the end.',
                type: 'string',
              },
              sharedDb: {
                shortcut: 'h',
                usage: 'DynamoDB will use a single database file, instead of using separate files for each credential and region. If you specify -sharedDb, all DynamoDB clients will interact with the same set of tables regardless of their region and credential configuration.',
                type: 'boolean',
              },
              delayTransientStatuses: {
                shortcut: 't',
                usage: 'Causes DynamoDB to introduce delays for certain operations. DynamoDB can perform some tasks almost instantaneously, such as create/update/delete operations on tables and indexes; however, the actual DynamoDB service requires more time for these tasks. Setting this parameter helps DynamoDB simulate the behavior of the Amazon DynamoDB web service more closely. (Currently, this parameter introduces delays only for global secondary indexes that are in either CREATING or DELETING status.',
                type: 'boolean',
              },
              optimizeDbBeforeStartup: {
                shortcut: 'o',
                usage: 'Optimizes the underlying database tables before starting up DynamoDB on your computer. You must also specify -dbPath when you use this parameter.',
                type: 'boolean',
              },
              help: {
                usage: 'Prints a usage summary and options.',
                type: 'boolean',
              },
              heapInitial: {
                usage: 'The initial heap size. Specify megabytes, gigabytes or terabytes using m, b, t. E.g., "2m"',
                type: 'string',
              },
              heapMax: {
                usage: 'The maximum heap size. Specify megabytes, gigabytes or terabytes using m, b, t. E.g., "2m"',
                type: 'string',
              },
              docker: {
                usage: 'Run DynamoDB inside docker container instead of as a local Java program.',
                type: 'boolean',
              },
              dockerPath: {
                usage: 'If docker enabled, custom docker path to use.',
                type: 'string',
              },
              dockerImage: {
                usage: 'If docker enabled, docker image to run.',
                type: 'string',
              },
              convertEmptyValues: {
                shortcut: 'e',
                usage: 'Set to true if you would like the document client to convert empty values (0-length strings, binary buffers, and sets) to be converted to NULL types when persisting to DynamoDB.',
                type: 'boolean',
              },
              noStart: {
                usage: 'Do not start DynamoDB local (e.g. for use cases where it is already running)',
                type: 'boolean',
              },
              migrate: {
                shortcut: 'm',
                usage: 'After starting dynamodb local, create DynamoDB tables from the current serverless configuration.',
                type: 'boolean',
              },
              seed: {
                shortcut: 's',
                usage: 'After starting and migrating dynamodb local, injects seed data into your tables. The --seed option determines which data categories to onload.',
                type: 'string',
              },
            },
          },
          remove: {
            lifecycleEvents: ['removeHandler'],
            usage: 'Removes local DynamoDB',
          },
          install: {
            usage: 'Installs local DynamoDB',
            lifecycleEvents: ['installHandler'],
            options: {
              localPath: {
                shortcut: 'x',
                usage: 'Local dynamodb install path',
                type: 'string',
              },
            },

          },
        },
      },
    };

    this.hooks = {
      'dynamodb:migrate:migrateHandler': this.migrateHandler.bind(this),
      'dynamodb:seed:seedHandler': this.seedHandler.bind(this),
      'dynamodb:remove:removeHandler': this.removeHandler.bind(this),
      'dynamodb:install:installHandler': this.installHandler.bind(this),
      'dynamodb:start:startHandler': this.startHandler.bind(this),
      'before:offline:start:init': this.startHandler.bind(this),
      'before:offline:start:end': this.endHandler.bind(this),
    };
  }

  get port() {
    return this.config?.start?.port ?? 8000;
  }

  get host() {
    return this.config?.start?.host ?? 'localhost';
  }

  get stage(): string {
    return (this.options && this.options.stage) || (this.serverless.service.provider && this.serverless.service.provider.stage);
  }

  /**
   * Check if the handler needs to be executed based on stage
   */
  shouldExecute(): boolean {
    if (!this.config.stages || this.config.stages.includes(this.stage)) {
      return true;
    }
    return false;
  }

  dynamodbOptions() {
    let dynamoOptions = {};

    if (this.options?.['online']) {
      this.serverless.cli.log('Connecting to online tables...');
      if (!this.options.region) {
        throw new Error('please specify the region');
      }
      dynamoOptions = {
        region: this.options.region,
      };
    } else {
      dynamoOptions = {
        endpoint: `http://${this.host}:${this.port}`,
        region: this.config?.start?.region ?? 'localhost',
        credentials: {
          accessKeyId: 'MockAccessKeyId',
          secretAccessKey: 'MockSecretAccessKey',
        },
      };
    }
    const translateConfig = {
      marshallOptions: {
        convertEmptyValues: Boolean(this.options?.['convertEmptyValues']),
      },
    };

    const raw = new DynamoDBClient(dynamoOptions);
    return {
      raw,
      doc: DynamoDBDocumentClient.from(raw, translateConfig),
    };
  }

  async migrateHandler() {
    if (this.shouldExecute()) {
      const dynamodb = this.dynamodbOptions();
      await Promise.all(this.tableDefinitions.map((table) => this.createTable(dynamodb, table)));
      return;
    }
    this.serverless.cli.log(`Skipping migration: DynamoDB Local is not available for stage: ${this.stage}`);
  }

  async seedHandler() {
    if (this.shouldExecute()) {
      const dynamodb = this.dynamodbOptions();

      await Promise.all(this.seedSources.map(async (source) => {
        if (!source.table) {
          throw new Error('seeding source "table" property not defined');
        }
        const seedPromise = writeSeeds((params) => dynamodb.doc.send(new BatchWriteCommand(params)), source.table, locateSeeds(source.sources || []));
        const rawSeedPromise = writeSeeds((params) => dynamodb.raw.send(new BatchWriteItemCommand(params)), source.table, locateSeeds(source.rawsources || []));
        await Promise.all([seedPromise, rawSeedPromise]);
        console.log(`Seed running complete for table: ${source.table}`);
      }));
      return;
    }
    this.serverless.cli.log(`Skipping seeding: DynamoDB Local is not available for stage: ${this.stage}`);
  }

  async removeHandler() {
    return dynamodbLocal.remove({ installPath: this.options.localPath });
  }

  async installHandler() {
    return dynamodbLocal.install({ installPath: this.options.localPath });
  }

  async startHandler() {
    if (this.shouldExecute()) {
      const options = {
        sharedDb: this.options['sharedDb'] ?? true,
        installPath: this.options.localPath,
        ...this.config.start,
        ...this.options,
      };

      if (options.dbPath && !path.isAbsolute(options.dbPath)) {
        options.dbPath = path.join(this.serverless.config.servicePath, options.dbPath);
      }

      if (!options.noStart) {
        await dynamodbLocal.start(options);
      }
      if (options.migrate) {
        await this.migrateHandler();
      }
      if (options.seed) {
        await this.seedHandler();
      }
    } else {
      this.serverless.cli.log(`Skipping start: DynamoDB Local is not available for stage: ${this.stage}`);
    }
  }

  async endHandler() {
    const options = {
      ...this.config.start,
      ...this.options,
    };

    if (this.shouldExecute() && !options['noStart']) {
      this.serverless.cli.log('DynamoDB - stopping local database');
      dynamodbLocal.stop(this.port);
    } else {
      this.serverless.cli.log(`Skipping end: DynamoDB Local is not available for stage: ${this.stage}`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getTableDefinitionsFromStack(stack: Aws.Resources): CloudFormationResource['Properties'][] {
    const resources = stack.Resources ?? [];
    return Object.keys(resources).flatMap((key) => {
      if (resources[key]?.Type === 'AWS::DynamoDB::Table') {
        return [resources[key]!.Properties];
      }
      return [];
    });
  }

  get tableDefinitions(): CloudFormationResource['Properties'][] {
    const stacks: Aws.Resources[] = [];

    const defaultStack = this.serverless.service.resources;
    if (defaultStack) {
      stacks.push(defaultStack as Aws.Resources);
    }

    if (this.serverless.service.plugins?.includes('serverless-plugin-additional-stacks')) {
      stacks.push(...Object.values<Aws.Resources>(this.serverless.service.custom?.['additionalStacks'] ?? {}));
    }

    return stacks.map((stack) => this.getTableDefinitionsFromStack(stack)).reduce((tables, tablesInStack) => tables.concat(tablesInStack), []);
  }

  /**
     * Gets the seeding sources
     */
  get seedSources(): SeedConfig[string]['sources'] {
    const seedConfig = this.config.seed ?? {};
    const seed = this.options['seed'] || this.config.start?.seed || seedConfig;
    let categories;
    if (typeof seed === 'string') {
      categories = seed.split(',');
    } else if (seed) {
      categories = Object.keys(seedConfig);
    } else { // if (!seed)
      this.serverless.cli.log('DynamoDB - No seeding defined. Skipping data seeding.');
      return [];
    }

    return categories.flatMap((category) => {
      if (category in seedConfig) {
        return seedConfig[category]!.sources;
      }
      throw new Error(`Missing category in seed configuration: ${category}`);
    });
  }

  // TODO: fix the types here
  async createTable(
    dbClients: { raw: DynamoDBClient, doc: DynamoDBDocumentClient },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migration: CloudFormationResource['Properties'] & Record<string, any>,
  ) {
    const command = migration;

    if (command['StreamSpecification']?.StreamViewType) {
      command['StreamSpecification'].StreamEnabled = true;
    }
    if (command['TimeToLiveSpecification']) {
      delete command['TimeToLiveSpecification'];
    }
    if (command['SSESpecification']) {
      command['SSESpecification'].Enabled = command['SSESpecification'].SSEEnabled;
      delete command['SSESpecification'].SSEEnabled;
    }
    if (command['PointInTimeRecoverySpecification']) {
      delete command['PointInTimeRecoverySpecification'];
    }
    if (command['DeletionProtectionEnabled']) {
      delete command['DeletionProtectionEnabled'];
    }
    if (command['Tags']) {
      delete command['Tags'];
    }
    if (command['BillingMode'] === 'PAY_PER_REQUEST') {
      delete command['BillingMode'];

      const defaultProvisioning = {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      };
      command['ProvisionedThroughput'] = defaultProvisioning;
      if (command['GlobalSecondaryIndexes']) {
        for (let i = 0; i < command['GlobalSecondaryIndexes'].length; i++) {
          command['GlobalSecondaryIndexes'][i].ProvisionedThroughput = defaultProvisioning;
        }
      }
    }

    if (command['ContributorInsightsSpecification']) {
      delete command['ContributorInsightsSpecification'];
    }
    if (command['KinesisStreamSpecification']) {
      delete command['KinesisStreamSpecification'];
    }
    if (command['GlobalSecondaryIndexes']) {
      for (let i = 0; i < command['GlobalSecondaryIndexes'].length; i++) {
        delete command['GlobalSecondaryIndexes'][i].ContributorInsightsSpecification;
      }
    }

    try {
      await dbClients.raw.send(new CreateTableCommand(command as unknown as CreateTableCommandInput));
      this.serverless.cli.log(`DynamoDB - created table ${command['TableName']}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'ResourceInUseException') {
        this.serverless.cli.log(`DynamoDB - Warn - table ${command['TableName']} already exists`);
      } else if (err instanceof Error) {
        this.serverless.cli.log('DynamoDB - Error - ', err.message);
        throw err;
      } else {
        const normalizedErr = new Error(String(err));
        this.serverless.cli.log('DynamoDB - Error - ', normalizedErr.message);
        throw normalizedErr;
      }
    }
  }
}

// NB: export default (as opposed to export =) does not work here with Serverless
export = ServerlessDynamoDBPlugin;
