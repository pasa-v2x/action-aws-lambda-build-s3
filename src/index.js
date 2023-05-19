// const assumeRole = require("./assumeRole")
const build = require("./build")
const core = require("@actions/core");

async function run() {
  // await assumeRole();
  
  try {
    const lambdaPaths = parseLambdaPaths();
    lambdaPaths.forEach((lambdaPath) => {
      build(lambdaPath);
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

function parseLambdaPaths() {
  const input = core.getInput("lambda-paths", { required: true })
  const lambdaPaths = [];
  for (const path of input.split(/\r|\n/)) {
    lambdaPaths.push(path.trim());
  }
  return lambdaPaths;
}

run();
