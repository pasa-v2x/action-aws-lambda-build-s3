const process = require("process");
const cp = require("child_process");
const path = require("path");

// shows how the runner will run a javascript action with env / stdout protocol
test("test runs", () => {
//   process.env["INPUT_ROLE"] =
//     "arn:aws:iam::462683447142:role/github-actions-role";
//   process.env["INPUT_REGION"] =
//     "arn:aws:iam::462683447142:role/github-actions-role";
//   process.env["INPUT_PATHS"] =
//     "arn:aws:iam::462683447142:role/github-actions-role";
//   process.env["INPUT_BUCKET"] =
//     "arn:aws:iam::462683447142:role/github-actions-role";

  const ip = path.join(__dirname, "..", "src/index.js");
  const result = cp.execSync(`node ${ip}`, { env: process.env }).toString();
  console.log(result);
});
