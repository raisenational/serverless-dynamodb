# serverless-dynamodb

> **Note**
> This is a continuation of and drop-in replacement for `serverless-dynamodb-local`
> (for more info, see [migrating from serverless-dynamodb-local](#migrating-from-serverless-dynamodb-local))

This [Serverless Framework](https://github.com/serverless/serverless) plugin allows you to run [AWS DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) via [aws-dynamodb-local](https://github.com/raisenational/aws-dynamodb-local).

Features:
- Download and install DynamoDB Local
- Start, stop and restart DynamoDB Local, supporting optional attributes as per [AWS's DynamoDB Local Documentation](http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) such as `port`, `inMemory`, `sharedDb`.
- Run DynamoDB Local as a Java program or in a docker container.
- Uninstall and remove DynamoDB Local.
- Create tables (migrations), and insert seed data.
- Compatible with other plugins, including `serverless-offline`, `serverless-webpack` and `serverless-offline-ses-v2`.

## Install

Requires:
- [Node.js](https://nodejs.org/)
- [Serverless](https://github.com/serverless/serverless) v1, v2 or v3
- One of:
  - Java (either JRE or JDK) version 11.x or newer, for example [Adoptium](https://adoptium.net/)
  - [Docker Engine and CLI](https://docs.docker.com/engine/install/)

Run `npm install serverless-dynamodb`

If using the Java version (i.e. not docker), install DynamoDB Local with `serverless dynamodb install`

## Usage

### Serverless configuration

Add it to your list of plugins, optionally with custom config:

serverless.yml:

```yaml
plugins:
  - serverless-dynamodb
  - serverless-offline

custom:
  serverless-dynamodb:
    start:
      port: 8000
      docker: false
```

serverless.js / serverless.ts:

```ts
export default {
  plugins: [
    "serverless-dynamodb",
    "serverless-offline",
  ],
  custom: {
    'serverless-dynamodb': {
      start: {
        port: 8000,
        docker: false,
      }
    }
  }
}
```

### In your code

Set the 'region', 'endpoint' and 'credentials' parameters in the AWS SDK constructor. For example with the AWS SDK V3 (recommended):

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: 'localhost',
  endpoint: 'http://0.0.0.0:8000',
  credentials: {
    accessKeyId: 'MockAccessKeyId',
    secretAccessKey: 'MockSecretAccessKey'
  },
})
```

Or with the older AWS SDK V2:

```ts
import AWS from "aws-sdk";

const client = new AWS.DynamoDB.DocumentClient({
  region: 'localhost',
  endpoint: 'http://0.0.0.0:8000',
  accessKeyId: 'MockAccessKeyId',
  secretAccessKey: 'MockSecretAccessKey',
});
```

### Running

#### With serverless-offline

Start serverless-offline with `serverless offline start`. It automatically starts DynamoDB Local from this plugin.

Add both plugins to your serverless config file, for example:

```yaml
plugins:
  - serverless-dynamodb
  - serverless-offline # must be loaded after
```

To stop serverless-offline, and DynamoDB Local, enter Ctrl+C in the terminal window.

#### Manually

Start DynamoDB Local with `serverless dynamodb start`. DynamoDB Local will begin processing incoming requests.

To stop DynamoDB Local, enter Ctrl+C in the terminal window.

## Command reference

### Install: serverless dynamodb install

This installs the Java program locally. If using docker, this step is not required.

To remove the installed dynamodb local, run:
`serverless dynamodb remove`
Note: This is useful if the serverless dynamodb install failed in between to completely remove and install a new copy of DynamoDB local.

### Start: serverless dynamodb start

This starts the DynamoDB Local instance, either as a local Java program or, if the `--docker` flag is set, by running it within a docker container.

All CLI options are optional:

```ts
interface StartOptions {
  /** Port to listen on. @default 8000 */
  port: number,

  /** Enable CORS support (cross-origin resource sharing) for JavaScript. You must provide a comma-separated "allow" list of specific domains. @default "*", which allows public access. */
  cors: string,

  /** Whether to run in memory, instead of using a database file. When you stop DynamoDB none of the data will be saved. Note that you cannot specify both dbPath and inMemory at once. @default true */
  inMemory: boolean,

  /** The directory where DynamoDB will write its database file. If you do not specify this option, the file will be written to the current directory. Note that you cannot specify both dbPath and inMemory at once. For the path, current working directory is <projectroot>/node_modules/aws-dynamodb-local/dynamodb. For example to create <projectroot>/node_modules/aws-dynamodb-local/dynamodb/<mypath> you should specify '<mypath>/' with a forward slash at the end. @default undefined */
  dbPath: string | undefined,

  /** DynamoDB will use a single database file, instead of using separate files for each credential and region. If you specify sharedDb, all DynamoDB clients will interact with the same set of tables regardless of their region and credential configuration. @default true */
  sharedDb: boolean,

  /** Causes DynamoDB to introduce delays for certain operations. DynamoDB can perform some tasks almost instantaneously, such as create/update/delete operations on tables and indexes; however, the actual DynamoDB service requires more time for these tasks. Setting this parameter helps DynamoDB simulate the behavior of the Amazon DynamoDB web service more closely. (Currently, this parameter introduces delays only for global secondary indexes that are in either CREATING or DELETING status.) @default true */
  delayTransientStatuses: boolean,

  /** Optimizes the underlying database tables before starting up DynamoDB on your computer. You must also specify -dbPath when you use this parameter. @default true */
  optimizeDbBeforeStartup: boolean,

  /** Prints a usage summary and options. */
  help: boolean,

  /** A string which sets the initial heap size e.g. '2G'. This is input to the java -Xms argument. @default undefined */
  heapInitial: string | undefined,

  /** A string which sets the maximum heap size e.g. '4G'. This is input to the java -Xmx argument. @default undefined */
  heapMax: string | undefined,

  /** Run DynamoDB inside docker container instead of as a local Java program. @default false */
  docker: boolean,

  /** If docker enabled, custom docker path to use. @default "docker" */
  dockerPath: string,

  /** If docker enabled, docker image to run. @default "amazon/dynamodb-local" */
  dockerImage: string,

  /** Set to true if you would like the document client to convert empty values (0-length strings, binary buffers, and sets) to be converted to NULL types when persisting to DynamoDB. **/
  convertEmptyValues: boolean,

  /** Do not start DynamoDB local (e.g. for use cases where it is already running) */
  noStart: boolean,

  /** After starting DynamoDB local, create DynamoDB tables from the Serverless configuration. */
  migrate: boolean,

  /** After starting and migrating dynamodb local, injects seed data into your tables. The --seed option determines which data categories to onload. */
  seed: boolean,  
}
```

All the above options can be added to serverless.yml to set default configuration: e.g.

```yaml
custom:
  serverless-dynamodb:
    # If you only want to use DynamoDB Local in some stages, declare them here
    stages:
      - dev
    start:
      port: 8000
      inMemory: true
      heapInitial: 200m
      heapMax: 1g
      migrate: true
      seed: true
      convertEmptyValues: true
    # Uncomment only if you already have a DynamoDB running locally
    # noStart: true
```

Docker setup:
```yaml
custom:
  serverless-dynamodb:
  # If you only want to use DynamoDB Local in some stages, declare them here
    stages:
      - dev
    start:
      docker: true
      port: 8000
      inMemory: true
      migrate: true
      seed: true
      convertEmptyValues: true
    # Uncomment only if you already have a DynamoDB running locally
    # noStart: true
```

Localstack setup:
```yaml
custom:
  serverless-dynamodb:
    # If you only want to use DynamoDB Local in some stages, declare them here
    stages:
      - dev
    start:
      # The port that your localstack is running on
      port: 4566
      migrate: true
      seed: true
      noStart: true
      # Beware, region is important for localstack
      region: 'eu-west-1'
```

### Migrations: serverless dynamodb migrate

#### Configuration

In `serverless.yml` add following to execute all the migration upon DynamoDB Local Start

```yaml
custom:
  serverless-dynamodb:
    start:
      migrate: true
```

#### AWS::DynamoDB::Table Resource Template for serverless.yml

Add [DynamoDB Resource definitions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-dynamodb-table.html) to your [Serverless resources configuration](https://www.serverless.com/framework/docs/providers/aws/guide/resources/#configuration). For example:

```yaml
resources:
  Resources:
    usersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: usersTable
        AttributeDefinitions:
          - AttributeName: email
            AttributeType: S
        KeySchema:
          - AttributeName: email
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 1
          WriteCapacityUnits: 1
```

**Note:**
DynamoDB local doesn't support TTL specification, therefore plugin will simply ignore ttl configuration from Cloudformation template.

### Seeding: serverless dynamodb seed

#### Configuration

In `serverless.yml` seeding categories are defined under `serverless-dynamodb.seed`.

If `serverless-dynamodb.start.seed` is true, then seeding is performed after table migrations.

If you wish to use raw AWS AttributeValues to specify your seed data instead of Javascript types then simply change the variable of any such json files from `sources:` to `rawsources:`.

```yaml
custom:
  serverless-dynamodb:
    start:
      seed: true

    seed:
      domain:
        sources:
          - table: domain-widgets
            sources: [./domainWidgets.json]
          - table: domain-fidgets
            sources: [./domainFidgets.json]
      test:
        sources:
          - table: users
            rawsources: [./fake-test-users.json]
          - table: subscriptions
            sources: [./fake-test-subscriptions.json]
```

```bash
serverless dynamodb seed --seed=domain,test
serverless dynamodb start --seed=domain,test
```

The JSON files for sources should look like:

```json
[
  {
    "id": "John",
    "name": "Doe",
  },
]
```

## Migrating from `serverless-dynamodb-local`

This is a drop-in replacement for `serverless-dynamodb-local`. To upgrade therefore:

1. Uninstall `serverless-dynamodb-local`, e.g. `npm uninstall serverless-dynamodb-local`
2. Install `serverless-dynamodb`, e.g. `npm install serverless-dynamodb`
3. Update references in your code, including your serverless config, from `serverless-dynamodb-local` to `serverless-dynamodb`
4. (optional) Update your serverless config custom `dynamodb` key to `serverless-dynamodb`

### Why fork?

**DynamoDB Local changes:** AWS continue to make changes to DynamoDB local, including breaking changes. These changes [break](https://github.com/99x/dynamodb-localhost/issues/79) [things](https://github.com/99x/dynamodb-localhost/issues/83) [in](https://github.com/99x/serverless-dynamodb-local/issues/297) [some](https://github.com/99x/serverless-dynamodb-local/issues/294) [packages](https://github.com/99x/dynamodb-localhost/issues/62), including `serverless-dynamodb-local`.

**99x have stopped maintenance:** 99x used to maintain `dynamodb-localhost` and `serverless-dynamodb-local`. Unfortunately in recent years 99x have stopped updating these packages. They do not look likely to fix these issues soon: many issues and PRs for critical problems have been sitting around for some years now, and the libraries are effectively unusable as-is now. We tried contacting them by email about this, and asked whether they could merge the critical PRs or pass ownership to someone who would maintain the packages. We did not get a reply.

**Need for stability and reliability:** At [Raise](https://github.com/raisenational), we've found these packages useful for developing our open-source campaigns platform. However, these packages frequently cause us pain: having to constantly apply custom patches to them and having them break in unexpected ways. We'd like to make the packages stable and reliable for all to use, as well as support the community around these packages.

### Why this fork?

At the time of forking, we reviewed other forks available and found none of them met our criteria:

- Actively maintained (e.g. addressed AWS's recent changes to DynamoDB Local v2.x)
- Indication that maintenance would continue (e.g. made some commitment to maintaining it into the future, and ideally had organizational backing)
- Well documented (e.g. had updated their documentation to correctly explain how to install the fork)
- Open to community contributions (e.g. were open to PRs, had contributing instructions)

We hope to address all of these, so that people have a stable and reliable version to depend on:

- Maintenance:
  - We depend on this library to work properly, so that we can develop and test key applications we have in production. As such, we're likely to catch issues quickly ourselves and care about resolving them quickly.
  - We've got experience and a history of maintaining similar libraries. For example, we created and maintain [aws-ses-v2-local](https://github.com/domdomegg/aws-ses-v2-local) and [serverless-offline-ses-v2](https://github.com/domdomegg/serverless-offline-ses-v2): tools to run the AWS SES service locally. It gets thousands of downloads per week, is actively maintained, and we have reviewed and accepted many community issues and PRs.
- Maintenance continuing:
  - We've used this library ourselves for a couple years in our most important applications, and it doesn't look like it's going anywhere. We're highly incentivized to ensure this is kept well maintained for the long-term.
  - We have a track record of maintaining products externally for a long time. We've never deprecated an in-use library, and we're hitting our [5 year anniversary on some of our libraries](https://github.com/domdomegg/halifax-share-dealing-sdk).
  - Raise is a [registered charity in England and Wales](https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/5208930) with multiple software engineers, and has been operating for several years.
  - We're publicly committed to a long-term maintenance plan. In the unlikely event that we are unable to continue maintaining this library, we commit to transferring ownership to another organization, as directed by the community, that will look after this library well.
- Well documented:
  - We care deeply about solid documentation, and ideally writing code that makes things so easy to use they don't need documentation. We intentionally changed the name to distinguish this package easily, and updated the documentation here to explain the relationship between this and `dynamodb-localhost`.
- Community:
  - We're committed to supporting the community around `aws-dynamodb-local` and `serverless-dynamodb`. We're a charity that works in the open, with all our software projects being open-source. Our team members have experience supporting communities on several open-source projects, as well as being open-source maintainers of popular projects that accept community contributions.

If you have feedback on our fork, positive or constructive, we'd love to hear it. Either [open a GitHub issue](https://github.com/raisenational/serverless-dynamodb/issues/new) or contact us using the details on [our profile](https://github.com/raisenational).

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.

## Credits

serverless-dynamodb is derived from [99x/serverless-dynamodb-local](https://github.com/99x/serverless-dynamodb-local).
