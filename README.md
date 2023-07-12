# Build Lambda and Lambda Layer Zips and load to S3

## Usage



```
jobs:
  build-lambdas:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x]
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: <ROLE_TO_ASSUME_WITH_S3_Write_ACCESS>
          aws-region: <AWS_REGION>
      
      - name: Build Lambda Zips and Upload to S3
        uses: pasa-v2x/action-aws-lambda-zips-artifact@main
        with:
          s3-bucket: cirrus-terraform-lambda-artifacts
          lambda-paths: |-
            device-data-collector/batch-query-device
            device-data-collector/device-query-transform
            device-data-collector/enqueue-rsus-for-data-collection
```


## Development

### Code in Main

Install the dependencies

```bash
npm install
```

Run the tests :heavy_check_mark:

```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)
...
```


## Package for distribution

GitHub Actions will run the entry point from the action.yml. Packaging assembles the code into one file that can be checked in to Git, enabling fast and reliable execution and preventing the need to check in node_modules.

Actions are run from GitHub repos.  Packaging the action will create a packaged action in the dist folder.

Run prepare

```bash
npm run prepare
```

Since the packaged index.js is run from the dist folder.

```bash
git add dist
```

## Create a release branch

Users shouldn't consume the action from master since that would be latest code and actions can break compatibility between major versions.

Checkin to the v1 release branch

```bash
git checkout -b v1
git commit -a -m "v1 release"
```

```bash
git push origin v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket:

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Usage

You can now consume the action by referencing the v1 branch

```yaml
uses: actions/javascript-action@v1
with:
  milliseconds: 1000
```

See the [actions tab](https://github.com/actions/javascript-action/actions) for runs of this action! :rocket:
