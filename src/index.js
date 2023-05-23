const build = require("./build")
const upload = require("./upload")
const core = require("@actions/core");

async function run() {
  try {
    const lambdaPaths = parseLambdaPaths();
    const builds = []
    lambdaPaths.forEach((lambdaPath) => {
      builds.push(build(lambdaPath));
    });
    upload(builds);
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
