"use strict";
const { DynamoDBClient, CreateTableCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const dynamodbLocal = require("aws-dynamodb-local");
const seeder = require("./src/seeder");
const path = require('path');

class ServerlessDynamodbLocal {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.service = serverless.service;
        this.serverlessLog = serverless.cli.log.bind(serverless.cli);
        this.config = this.service.custom && this.service.custom['serverless-dynamodb'] || this.service.custom.dynamodb || {};
        this.options = {
            localPath: serverless.config && path.join(serverless.config.servicePath, '.dynamodb'),
            ...options,
        };
        this.provider = "aws";
        this.commands = {
            dynamodb: {
                commands: {
                    migrate: {
                        lifecycleEvents: ["migrateHandler"],
                        usage: "Creates local DynamoDB tables from the current Serverless configuration"
                    },
                    seed: {
                        lifecycleEvents: ["seedHandler"],
                        usage: "Seeds local DynamoDB tables with data",
                        options: {
                            online: {
                                shortcut: "o",
                                usage: "Will connect to the tables online to do an online seed run",
                                type: "boolean"
                            },
                            seed: {
                                shortcut: "s",
                                usage: "After starting and migrating dynamodb local, injects seed data into your tables. The --seed option determines which data categories to onload.",
                                // NB: no `type` intentionally to allow both boolean and string values
                            },
                        }
                    },
                    start: {
                        lifecycleEvents: ["startHandler"],
                        usage: "Starts local DynamoDB",
                        options: {
                            port: {
                                shortcut: "p",
                                usage: "The port number that DynamoDB will use to communicate with your application. If you do not specify this option, the default port is 8000",
                                type: "string"
                            },
                            cors: {
                                shortcut: "c",
                                usage: "Enable CORS support (cross-origin resource sharing) for JavaScript. You must provide a comma-separated \"allow\" list of specific domains. The default setting for -cors is an asterisk (*), which allows public access.",
                                type: "string"
                            },
                            inMemory: {
                                shortcut: "i",
                                usage: "DynamoDB; will run in memory, instead of using a database file. When you stop DynamoDB;, none of the data will be saved. Note that you cannot specify both -dbPath and -inMemory at once.",
                                type: "boolean"
                            },
                            dbPath: {
                                shortcut: "d",
                                usage: "The directory where DynamoDB will write its database file. If you do not specify this option, the file will be written to the current directory. Note that you cannot specify both -dbPath and -inMemory at once. For the path, current working directory is <projectroot>/node_modules/serverless-dynamodb-local/dynamob. For example to create <projectroot>/node_modules/serverless-dynamodb-local/dynamob/<mypath> you should specify -d <mypath>/ or --dbPath <mypath>/ with a forwardslash at the end.",
                                type: "string"
                            },
                            sharedDb: {
                                shortcut: "h",
                                usage: "DynamoDB will use a single database file, instead of using separate files for each credential and region. If you specify -sharedDb, all DynamoDB clients will interact with the same set of tables regardless of their region and credential configuration.",
                                type: "boolean"
                            },
                            delayTransientStatuses: {
                                shortcut: "t",
                                usage: "Causes DynamoDB to introduce delays for certain operations. DynamoDB can perform some tasks almost instantaneously, such as create/update/delete operations on tables and indexes; however, the actual DynamoDB service requires more time for these tasks. Setting this parameter helps DynamoDB simulate the behavior of the Amazon DynamoDB web service more closely. (Currently, this parameter introduces delays only for global secondary indexes that are in either CREATING or DELETING status.",
                                type: "boolean"
                            },
                            optimizeDbBeforeStartup: {
                                shortcut: "o",
                                usage: "Optimizes the underlying database tables before starting up DynamoDB on your computer. You must also specify -dbPath when you use this parameter.",
                                type: "boolean"
                            },
                            help: {
                                usage: "Prints a usage summary and options.",
                                type: "boolean",
                            },
                            heapInitial: {
                                usage: 'The initial heap size. Specify megabytes, gigabytes or terabytes using m, b, t. E.g., "2m"',
                                type: "string"
                            },
                            heapMax: {
                                usage: 'The maximum heap size. Specify megabytes, gigabytes or terabytes using m, b, t. E.g., "2m"',
                                type: "string"
                            },
                            docker: {
                                usage: 'Run DynamoDB inside docker container instead of as a local Java program.',
                                type: "boolean"
                            },
                            dockerPath: {
                                usage: 'If docker enabled, custom docker path to use.',
                                type: "string"
                            },
                            dockerImage: {
                                usage: 'If docker enabled, docker image to run.',
                                type: "string"
                            },
                            convertEmptyValues: {
                                shortcut: "e",
                                usage: "Set to true if you would like the document client to convert empty values (0-length strings, binary buffers, and sets) to be converted to NULL types when persisting to DynamoDB.",
                                type: "boolean"
                            },
                            noStart: {
                              usage: "Do not start DynamoDB local (e.g. for use cases where it is already running)",
                              type: "boolean",
                            },
                            migrate: {
                                shortcut: "m",
                                usage: "After starting dynamodb local, create DynamoDB tables from the current serverless configuration.",
                                type: "boolean"
                            },
                            seed: {
                                shortcut: "s",
                                usage: "After starting and migrating dynamodb local, injects seed data into your tables. The --seed option determines which data categories to onload.",
                                // NB: no `type` intentionally to allow both boolean and string values
                            },
                        }
                    },
                    remove: {
                        lifecycleEvents: ["removeHandler"],
                        usage: "Removes local DynamoDB"
                    },
                    install: {
                        usage: "Installs local DynamoDB",
                        lifecycleEvents: ["installHandler"],
                        options: {
                            localPath: {
                                shortcut: "x",
                                usage: "Local dynamodb install path",
                                type: "string"
                            }
                        }

                    }
                }
            }
        };

        this.hooks = {
            "dynamodb:migrate:migrateHandler": this.migrateHandler.bind(this),
            "dynamodb:seed:seedHandler": this.seedHandler.bind(this),
            "dynamodb:remove:removeHandler": this.removeHandler.bind(this),
            "dynamodb:install:installHandler": this.installHandler.bind(this),
            "dynamodb:start:startHandler": this.startHandler.bind(this),
            "before:offline:start:init": this.startHandler.bind(this),
            "before:offline:start:end": this.endHandler.bind(this),
        };
    }

    get port() {
        return this.config?.start?.port ?? 8000;
    }

    get host() {
        return this.config?.start?.host ?? "localhost";
    }

    /**
     * Get the stage
     *
     * @return {String} the current stage
     */
    get stage() {
      return (this.options && this.options.stage) || (this.service.provider && this.service.provider.stage);
    }

    /**
     * To check if the handler needs to be executed based on stage
     *
     * @return {Boolean} if the handler can run for the provided stage
     */
    shouldExecute() {
      if (!this.config.stages || this.config.stages.includes(this.stage)) {
        return true;
      }
      return false;
    }

    dynamodbOptions(options) {
        let dynamoOptions = {};

        if(options && options.online){
            this.serverlessLog("Connecting to online tables...");
            if (!options.region) {
                throw new Error("please specify the region");
            }
            dynamoOptions = {
                region: options.region,
            };
        } else {
            dynamoOptions = {
                endpoint: `http://${this.host}:${this.port}`,
                region: "localhost",
                credentials: {
                    accessKeyId: "MockAccessKeyId",
                    secretAccessKey: "MockSecretAccessKey",
                },
            };
        }
        const translateConfig = {
            marshallOptions: {
                convertEmptyValues: options?.convertEmptyValues ?? false
            }
        }

        const raw = new DynamoDBClient(dynamoOptions);
        return {
            raw,
            doc: DynamoDBDocumentClient.from(raw, translateConfig)
        };
    }

    migrateHandler() {
        if (this.shouldExecute()) {
            const dynamodb = this.dynamodbOptions();
            const tables = this.tables;
            return Promise.all(tables.map((table) => this.createTable(dynamodb, table)));
        } else {
            this.serverlessLog("Skipping migration: DynamoDB Local is not available for stage: " + this.stage);
        }
    }

    seedHandler() {
        if (this.shouldExecute()) {
            const options = this.options;
            const dynamodb = this.dynamodbOptions(options);

            return Promise.all(this.seedSources.map((source) => {
                if (!source.table) {
                    throw new Error("seeding source \"table\" property not defined");
                }
                const seedPromise = seeder.writeSeeds((params) => dynamodb.doc.send(new BatchWriteCommand(params)), source.table, seeder.locateSeeds(source.sources || []));
                const rawSeedPromise = seeder.writeSeeds((params) => dynamodb.raw.send(new BatchWriteItemCommand(params)), source.table, seeder.locateSeeds(source.rawsources || []));
                return Promise.all([seedPromise, rawSeedPromise]);
            }));
        } else {
            this.serverlessLog("Skipping seeding: DynamoDB Local is not available for stage: " + this.stage);
        }
    }

    removeHandler() {
        return dynamodbLocal.remove({ installPath: this.options.localPath });
    }

    installHandler() {
        return dynamodbLocal.install({ installPath: this.options.localPath });
    }

    startHandler() {
        if (this.shouldExecute()) {
            const options = {
                sharedDb: this.options.sharedDb ?? true,
                installPath: this.options.localPath,
                ...this.config.start,
                ...this.options
            }

            // otherwise endHandler will be mis-informed
            this.options = options;

            let dbPath = options.dbPath;
            if (dbPath) {
              options.dbPath = path.isAbsolute(dbPath) ? dbPath : path.join(this.serverless.config.servicePath, dbPath);
            }

            return (options.noStart ? Promise.resolve() : dynamodbLocal.start(options))
            .then(() => options.migrate && this.migrateHandler())
            .then(() => options.seed && this.seedHandler());
        } else {
            this.serverlessLog("Skipping start: DynamoDB Local is not available for stage: " + this.stage);
        }
    }

    endHandler() {
        if (this.shouldExecute() && !this.options.noStart) {
            this.serverlessLog("DynamoDB - stopping local database");
            dynamodbLocal.stop(this.port);
        } else {
            this.serverlessLog("Skipping end: DynamoDB Local is not available for stage: " + this.stage);
        }
    }

    getDefaultStack() {
        return this.service.resources;
    }

    getAdditionalStacks() {
        return Object.values(this.service.custom?.additionalStacks ?? {});
    }

    hasAdditionalStacksPlugin() {
        return (this.service.plugins ?? []).includes("serverless-plugin-additional-stacks");
    }

    getTableDefinitionsFromStack(stack) {
        const resources = stack.Resources ?? [];
        return Object.keys(resources).map((key) => {
            if (resources[key].Type === "AWS::DynamoDB::Table") {
                return resources[key].Properties;
            }
        }).filter((n) => n);
    }

    /**
     * Gets the table definitions
     */
    get tables() {
        let stacks = [];

        const defaultStack = this.getDefaultStack();
        if (defaultStack) {
            stacks.push(defaultStack);
        }

        if (this.hasAdditionalStacksPlugin()) {
            stacks.push(...this.getAdditionalStacks());
        }

        return stacks.map((stack) => this.getTableDefinitionsFromStack(stack)).reduce((tables, tablesInStack) => tables.concat(tablesInStack), []);
    }

    /**
     * Gets the seeding sources
     */
    get seedSources() {
        const seedConfig = this.config.seed ?? {};
        const seed = this.options.seed || this.config.start.seed || seedConfig;
        let categories;
        if (typeof seed === "string") {
            categories = seed.split(",");
        } else if(seed) {
            categories = Object.keys(seedConfig);
        } else { // if (!seed)
            this.serverlessLog("DynamoDB - No seeding defined. Skipping data seeding.");
            return [];
        }
        const sourcesByCategory = categories.map((category) => seedConfig[category].sources);
        return [].concat.apply([], sourcesByCategory);
    }

    /**
     * @param {{ raw: DynamoDBClient, doc: DynamoDBDocumentClient }} dynamodb DynamoDB clients
     */
    async createTable(dynamodb, migration) {
        if (migration.StreamSpecification && migration.StreamSpecification.StreamViewType) {
            migration.StreamSpecification.StreamEnabled = true;
        }
        if (migration.TimeToLiveSpecification) {
            delete migration.TimeToLiveSpecification;
        }
        if (migration.SSESpecification) {
            migration.SSESpecification.Enabled = migration.SSESpecification.SSEEnabled;
            delete migration.SSESpecification.SSEEnabled;
        }
        if (migration.PointInTimeRecoverySpecification) {
            delete migration.PointInTimeRecoverySpecification;
        }
        if (migration.Tags) {
            delete migration.Tags;
        }
        if (migration.BillingMode === "PAY_PER_REQUEST") {
            delete migration.BillingMode;

            const defaultProvisioning = {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            };
            migration.ProvisionedThroughput = defaultProvisioning;
            if (migration.GlobalSecondaryIndexes) {
                migration.GlobalSecondaryIndexes.forEach((gsi) => {
                    gsi.ProvisionedThroughput = defaultProvisioning;
                });
            }
        }

        if(migration.ContributorInsightsSpecification) {
            delete migration.ContributorInsightsSpecification;
        }
        if(migration.KinesisStreamSpecification) {
            delete migration.KinesisStreamSpecification;
        }
        if(migration.GlobalSecondaryIndexes) {
            migration.GlobalSecondaryIndexes.forEach((gsi) => {
                if (gsi.ContributorInsightsSpecification) {
                    delete gsi.ContributorInsightsSpecification;
                }
            });
        }

        await dynamodb.raw.send(new CreateTableCommand(migration)).then(() => {
            this.serverlessLog("DynamoDB - created table " + migration.TableName);
            return migration;
        }).catch((err) => {
            if (err.name === 'ResourceInUseException') {
                this.serverlessLog(`DynamoDB - Warn - table ${migration.TableName} already exists`);
                return;
            } else {
                this.serverlessLog("DynamoDB - Error - ", err);
                throw err;
            }
        })
    }
}
module.exports = ServerlessDynamodbLocal;
