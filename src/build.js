const { execSync } = require("child_process");
const fs = require("fs");
const core = require("@actions/core");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const buildAndUpload = async function (dir) {
  // call git to get the full path to the directory of the repo
  const repoPath = execSync("git rev-parse --show-toplevel").toString().trim();

  // create full paths for exec commands
  const buildPath = "/tmp/build"
  fs.mkdirSync(buildPath, { recursive: true });
  const lambdaPath = `${repoPath}/${dir}`;

  const LANG = determineLanguage(lambdaPath);

  // get last folder in dir and use as artifactName
  const lambdaBaseName = dir.split("/").pop();
  const lambdaZipPath = `${buildPath}/${lambdaBaseName}.zip`;
  const lambdaLayerZipPath = `${buildPath}/${lambdaBaseName}_layer.zip`;

  // create switch the uses language to build
  switch (LANG) {
    case "golang":
      await buildGolang(lambdaPath, lambdaZipPath);
      break;
    case "python":
      await buildPython(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
      break;
    case "nodejs":
      await buildJavascript(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
      break;
    case "typescript":
      await buildTypescript(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
      break;
    default:
      core.setFailed("Language not supported");
  }
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

async function buildGolang(lambdaPath, lambdaZipPath) {
  const command = ` cd ${lambdaPath}
GOOS=linux GOARCH=amd64 go build -o handler
zip ${lambdaZipPath} handler
rm handler
`;
  try {
    execSync(command);
    upload(lambdaZipPath)
  } catch (error) {
    core.setFailed(`An error occurred while building Golang: ${error.message}`);
  }
}

async function buildPython(lambdaPath, lambdaZipPath, lambdaLayerZipPath) {
  const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${lambdaZipPath} .
`;
  try {
    execSync(zipLambdaCommand);
    upload(lambdaZipPath);

    let zipLayerCommand;
    if (fs.existsSync(`${lambdaPath}/Pipfile`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pipenv install
PY_VERSION=$(grep -oP 'python_version = "\K[^"]+' Pipfile)
SITE_PACKAGES=$(pipenv --venv)/lib/$PY_VERSION/site-packages
cd $SITE_PACKAGES
zip -q -r ${lambdaLayerZipPath} *
`;
    } else if (fs.existsSync(`${lambdaPath}/requirements.txt`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pip install -r requirements.txt -t python
zip -q -r ${lambdaLayerZipPath} python/
rm -Rf python
`;
    }else{
      return
    }
    execSync(zipLayerCommand);
    upload(lambdaLayerZipPath);
  } catch (error) {
    core.setFailed(`An error occurred while building Python: ${error.message}`);
  }
}

async function buildJavascript(
  lambdaPath,
  lambdaZipPath,
  lambdaLayerZipPath
) {
  try {
    const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${lambdaZipPath} .
`;
    execSync(zipLambdaCommand);
    upload(lambdaZipPath);

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);

      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.rmSync(`${lambdaPath}/nodejs`, { recursive: true, force: true });
        fs.mkdirSync(`${lambdaPath}/nodejs`, { recursive: true });        
        execSync(`mv ${lambdaPath}/node_modules ${lambdaPath}/nodejs`)
        execSync(`cd ${lambdaPath}
          zip -q -r ${lambdaLayerZipPath} nodejs
          cd -`);
        upload(lambdaLayerZipPath)
      }
      execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules`);
    }
  } catch (error) {
    core.setFailed(
      `An error occurred while building Javascript: ${error.message}`
    );
  }
}

async function buildTypescript(
  lambdaPath,
  lambdaZipPath,
  lambdaLayerZipPath
) {
  try {
    const lambdaCommand = ` cd ${lambdaPath}
npm install --production=false
npm run build
cd dist
zip -r ${lambdaZipPath} .
`;
    execSync(lambdaCommand);
    upload(lambdaZipPath);

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);
      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.rmSync(`${lambdaPath}/nodejs`, { recursive: true, force: true });
        fs.mkdirSync(`${lambdaPath}/nodejs`, { recursive: true });
        execSync(`mv ${lambdaPath}/node_modules ${lambdaPath}/nodejs`)
        execSync(`cd ${lambdaPath}
          zip -q -r ${lambdaLayerZipPath} nodejs
          cd -`);
      }
      execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules dist`);
      upload(lambdaLayerZipPath);
    }
  } catch (error) {
    core.setFailed(
      `An error occurred while building Typescript: ${error.message}`
    );
  }
}

async function upload(artifactPath){
  try {
    const bucket = core.getInput("s3-bucket", { required: true });
    const s3Client = new S3Client();

    // take the artifactPath grab the artifact filename
    const artifactName = artifactPath.split("/").pop();
    
    // call git to get commit hash
    const commitHash = execSync("git log -1 --format=format:%H")
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
}

module.exports = buildAndUpload;
