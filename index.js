const assumeRole = require("./assumeRole")
const build = require("./build")
const core = require("@actions/core");

async function run() {
  try {
    await assumeRole();

    const lambdaPaths = parseLambdaPaths();
    lambdaPaths.forEach((lambdaPath) => {
      build(lambdaPath);
    });
  } catch (error) {
    console.error(error);
  }
}

function parseLambdaPaths() {
  const input = core.getInput("lambda-paths", { required: true })
  const lambdaPaths = [];
  for (const path of input.split(/\r|\n/)) {
      lambdaPaths.push(path);
  }
  return lambdaPaths;
}

run();
