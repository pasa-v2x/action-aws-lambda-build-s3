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

  try {
    const resp = await sts.send(command);
    if (resp.error) throw resp.error;
    core.debug(`STS resp: ${resp}`);
    const { AccessKeyId, SecretAccessKey, SessionToken } = resp.Credentials;
    core.setSecret(AccessKeyId);
    core.exportVariable("AWS_ACCESS_KEY_ID", AccessKeyId);

    core.setSecret(SecretAccessKey);
    core.exportVariable("AWS_SECRET_ACCESS_KEY", SecretAccessKey);

    core.setSecret(SessionToken);
    core.exportVariable("AWS_SESSION_TOKEN", SessionToken);
  } catch (error) {
    core.setFailed(error.message);
  }
};

module.exports = assumeRole;
