const { execSync } = require("child_process");
const fs = require("fs");
const fsx = require("fs-extra");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const core = require("@actions/core");

let build = async function (dir) {
  // call git to get the full path to the directory of the repo
  const repoPath = execSync("git rev-parse --show-toplevel").toString().trim();

  // create full paths for exec commands
  const buildPath = `${repoPath}/build`;
  const lambdaPath = `${repoPath}/${dir}`;

  const LANG = determineLanguage(lambdaPath);

  // get last folder in dir and use as artifactName
  const artifactBaseName = dir.split("/").pop();
  const artifactName = `${artifactBaseName}.zip`;
  const artifactLayerName = `${artifactBaseName}_layer.zip`;

  // create switch the uses language to build
  switch (LANG) {
    case "golang":
      buildGolang(lambdaPath, buildPath, artifactName);
      break;
    case "python":
      buildPython(lambdaPath, buildPath, artifactName, artifactLayerName);
      break;
    case "nodejs":
      buildJavascript(lambdaPath, buildPath, artifactName, artifactLayerName);
      break;
    case "typescript":
      buildTypescript(lambdaPath, buildPath, artifactName, artifactLayerName);
      break;
    default:
      core.setFailed("Language not supported");
  }
  uploadToS3();
};

function determineLanguage(lambdaPath) {
  if (
    fs.existsSync(`${lambdaPath}/go.mod`) ||
    fs.existsSync(`${lambdaPath}/go.sum`)
  ) {
    return "golang";
  } else if (
    fs.existsSync(`${lambdaPath}/requirements.txt`) ||
    fs.existsSync(`${lambdaPath}/Pipfile`) ||
    fs.existsSync(`${lambdaPath}/Pipfile.lock`)
  ) {
    return "python";
  } else if (fs.existsSync(`${lambdaPath}/tsconfig.json`)) {
    return "typescript";
  } else if (
    fs.existsSync(`${lambdaPath}/package.json`) ||
    fs.existsSync(`${lambdaPath}/package-lock.json`) ||
    fs.existsSync(`${lambdaPath}/yarn.lock`) ||
    fs.existsSync(`${lambdaPath}/pnpm-lock.yaml`)
  ) {
    return "nodejs";
  }
}

function buildGolang(lambdaPath, buildPath, artifactName) {
  const command = ` cd ${lambdaPath}
GOOS=linux GOARCH=amd64 go build -o handler
zip ${buildPath}/${artifactName} handler
rm handler
`;
  try {
    execSync(command);
  } catch (error) {
    core.setFailed(`An error occurred while building Golang: ${error.message}`);
  }
}

function buildPython(lambdaPath, buildPath, artifactName, artifactLayerName) {
  const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${buildPath}/${artifactName} .
`;
  try {
    execSync(zipLambdaCommand);

    let zipLayerCommand;
    if (fs.existsSync(`${lambdaPath}/Pipfile`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pipenv requirements > requirements.txt
pip install -r requirements.txt -t python
zip -q -r ${buildPath}/${artifactLayerName} python/
rm -Rf python requirements.txt
  `;
    } else if (fs.existsSync(`${lambdaPath}/requirements.txt`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pip install -r requirements.txt -t python
zip -q -r ${buildPath}/${artifactLayerName} python/
rm -Rf python
`;
    }
    execSync(zipLayerCommand);
  } catch (error) {
    core.setFailed(`An error occurred while building Python: ${error.message}`);
  }
}

function buildJavascript(
  lambdaPath,
  buildPath,
  artifactName,
  artifactLayerName
) {
  try {
    const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${buildPath}/${artifactName} .
`;
    execSync(zipLambdaCommand);

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);

      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.mkdirSync(`${lambdaPath}/nodejs/node_modules`, { recursive: true });        
        fsx.moveSync(
          `${lambdaPath}/node_modules`,
          `${lambdaPath}/nodejs/node_modules`
        );
        execSync(`zip -q -r ${buildPath}/${artifactLayerName} nodejs/`);
      }
    }
    execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules`);
  } catch (error) {
    core.setFailed(
      `An error occurred while building Javascript: ${error.message}`
    );
  }
}

function buildTypescript(
  lambdaPath,
  buildPath,
  artifactName,
  artifactLayerName
) {
  try {
    const lambdaCommand = ` cd ${lambdaPath}
npm install --production=false
npm run build
cd dist
zip -r ${buildPath}/${artifactName} .
`;
    execSync(lambdaCommand);

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);
      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.mkdirSync(`${lambdaPath}/nodejs/node_modules`, { recursive: true });
        fsx.moveSync(
          `${lambdaPath}/node_modules`,
          `${lambdaPath}/nodejs/node_modules`
        );
        execSync(`zip -q -r ${buildPath}/${artifactLayerName} nodejs/`);
      }
    }
    execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules dist`);
  } catch (error) {
    core.setFailed(
      `An error occurred while building Typescript: ${error.message}`
    );
  }
}

async function uploadToS3(buildPath, artifactName, artifactLayerName) {
  const bucket = core.getInput("s3-bucket", { required: true });
  const s3Client = new S3Client();
  try {
    // call git to get commit hash
    const commitHash = execSync("git log -1 --format=format:%H")
      .toString()
      .trim();
    // call git to get the name of the repo
    const repoName = execSync("basename `git rev-parse --show-toplevel`")
      .toString()
      .trim();
    if (fs.existsSync(`${buildPath}/${artifactName}`)) {
      const uploadParams = {
        Bucket: bucket,
        Key: `${repoName}/${commitHash}/${artifactName}`,
        Body: fs.createReadStream(`${buildPath}/${artifactName}`),
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      fs.unlinkSync(`${buildPath}/${artifactName}`);
    }

    if (fs.existsSync(`${buildPath}/${artifactLayerName}`)) {
      const uploadParams = {
        Bucket: bucket,
        Key: `${repoName}/${commitHash}/${artifactLayerName}`,
        Body: fs.createReadStream(`${buildPath}/${artifactLayerName}`),
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      fs.unlinkSync(`${buildPath}/${artifactLayerName}`);
    }
  } catch (error) {
    core.setFailed(`An error occurred while uploading to S3: ${error.message}`);
  }
}

module.exports = build;
