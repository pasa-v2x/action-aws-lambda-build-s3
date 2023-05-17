const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const core = require("@actions/core");

function exportRegion(region) {
  core.exportVariable("AWS_DEFAULT_REGION", region);
  core.exportVariable("AWS_REGION", region);
}

let assumeRole = async function () {
  const awsRole = core.getInput("aws-role", { required: true });
  const awsRegion = core.getInput("aws-region", { required: true });
  exportRegion(awsRegion);

  const sts = new STSClient({ region: awsRegion });
  const command = new AssumeRoleCommand({
    RoleArn: awsRole,
    RoleSessionName: "lambda-build",
  });
  const creds = await sts.send(command).Credentials;

  core.setSecret(creds.AccessKeyId);
  core.exportVariable("AWS_ACCESS_KEY_ID", creds.AccessKeyId);

  core.setSecret(creds.SecretAccessKey);
  core.exportVariable("AWS_SECRET_ACCESS_KEY", creds.SecretAccessKey);

  core.setSecret(creds.SessionToken);
  core.exportVariable("AWS_SESSION_TOKEN", creds.SessionToken);
}

module.exports = { assumeRole };
