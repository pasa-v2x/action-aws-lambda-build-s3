const { create } = require("@actions/artifact");
const core = require("@actions/core");
const fs = require("fs");
const { execSync } = require("child_process");

const upload = async function () {
  try {
    
    const repoPath = execSync("git rev-parse --show-toplevel").toString().trim();
    const buildDir = repoPath + "/build";
    const fileArray = fs.readdirSync(buildDir);
    core.debug(`Files in build directory: ${fileArray}`);
    const artifactClient = create();

    const options = {
      continueOnError: false,
    };

    const uploadResponse = await artifactClient.uploadArtifact(
      core.getInput("github-artifact-name", { required: true }),
      fileArray,
      buildDir,
      options
    );

    if (uploadResponse.failedItems.length > 0) {
      core.setFailed(
        `An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`
      );
    } else {
      core.info(
        `Artifact ${uploadResponse.artifactName} has been successfully uploaded!`
      );
    }
  } catch (error) {
    core.setFailed("Error Uploading Lambda ZIPs artifact", error.message);
  }
};

module.exports = upload;
