// const { create } = require("@actions/artifact");
const core = require("@actions/core");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { execSync } = require("child_process");

const upload = async function (artifactPath) {
  // try {
    
  //   const buildDir = "/tmp/build";
  //   const fileArray = fs.readdirSync(buildDir);
  //   // loop through fileArray and prefix each filename with the buildDir
  //   fileArray.forEach((filename, index) => {
  //     fileArray[index] = `${buildDir}/${filename}`;
  //   });
    
  //   core.debug(`Files in build directory: ${fileArray}`);
  //   const artifactClient = create();

  //   const options = {
  //     continueOnError: false,
  //   };

  //   const uploadResponse = await artifactClient.uploadArtifact(
  //     core.getInput("github-artifact-name", { required: true }),
  //     fileArray,
  //     buildDir,
  //     options
  //   );

  //   if (uploadResponse.failedItems.length > 0) {
  //     core.setFailed(
  //       `An error was encountered when uploading ${uploadResponse.artifactName}. There were ${uploadResponse.failedItems.length} items that failed to upload.`
  //     );
  //   } else {
  //     core.info(
  //       `Artifact ${uploadResponse.artifactName} has been successfully uploaded!`
  //     );
  //   }
  // } catch (error) {
  //   core.setFailed(`Error Uploading Lambda ZIPs artifact: ${error.message}`);
  // }

  try {
    const bucket = core.getInput("s3-bucket", { required: true });
    const isShortHash = core.getInput("short-commit-hash", { required: false });
    const s3Client = new S3Client();

    // take the artifactPath grab the artifact filename
    const artifactName = artifactPath.split("/").pop();
    
    // call git to get commit hash
    const commitHash = execSync(`git log -1 --format=format:%${isShortHash ? 'h' : 'H'}`)
      .toString()
      .trim();
    // call git to get the name of the repo
    const repoName = execSync("basename `git rev-parse --show-toplevel`")
      .toString()
      .trim();
    if (fs.existsSync(artifactPath)) {
      const uploadParams = {
        Bucket: bucket,
        Key: `${repoName}/${commitHash}/${artifactName}`,
        Body: fs.createReadStream(artifactPath),
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      fs.unlinkSync(artifactPath);
    }
  } catch (error) {
    core.setFailed(`An error occurred while uploading to S3: ${error.message}`);
  }
};

module.exports = upload;
