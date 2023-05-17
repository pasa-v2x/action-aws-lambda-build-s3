const assumeRole = "./assumeRole"
const build = "./build"
const core = require("@actions/core");

async function run() {
  try {
    await assumeRole();

    const lambdaPaths = parseLambdaPaths();
    lambdaPaths.forEach((lambdaPath) => {
      build(lambdaPath);
    });
  } catch (error) {}
}

export function parseLambdaPaths() {
  input = core.getInput("lambda-paths", { required: true })
  const lambdaPaths = [];
  for (const path of input.split(/\r|\n/)) {
      lambdaPaths.push(path);
  }
  return lambdaPaths;
}

run();
