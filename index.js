const assumeRole = "./assumeRole"
const build = "./build"
const core = require("@actions/core");

async function run() {
  try {
    await assumeRole();

    const lambdaPaths = core.getInput("lambda-paths", { required: true });
    const lambdas = JSON.parse(lambdaPaths);
    lambdas.forEach((lambda) => {
      build(lambda);
    });
  } catch (error) {}
}

run();
