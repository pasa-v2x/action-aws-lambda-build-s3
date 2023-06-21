const { execSync } = require("child_process");
const fs = require("fs");
const core = require("@actions/core");

const build = async function (dir) {
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
      return buildGolang(lambdaPath, lambdaZipPath);
    case "python":
      return buildPython(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
    case "nodejs":
      return buildJavascript(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
    case "typescript":
      return buildTypescript(lambdaPath, lambdaZipPath, lambdaLayerZipPath);
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

function buildGolang(lambdaPath, lambdaZipPath) {
  const command = ` cd ${lambdaPath}
GOOS=linux GOARCH=amd64 go build -o handler
zip ${lambdaZipPath} handler
rm handler
`;
  try {
    execSync(command);
    return [lambdaZipPath]
  } catch (error) {
    core.setFailed(`An error occurred while building Golang: ${error.message}`);
  }
}

function buildPython(lambdaPath, lambdaZipPath, lambdaLayerZipPath) {
  const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${lambdaZipPath} .
`;
  try {
    execSync(zipLambdaCommand);

    let zipLayerCommand;
    if (fs.existsSync(`${lambdaPath}/Pipfile`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pipenv requirements > requirements.txt
pip install -r requirements.txt -t python
zip -q -r ${lambdaLayerZipPath} python/
rm -Rf python requirements.txt
  `;
    } else if (fs.existsSync(`${lambdaPath}/requirements.txt`)) {
      zipLayerCommand = ` cd ${lambdaPath}
pip install -r requirements.txt -t python
zip -q -r ${lambdaLayerZipPath} python/
rm -Rf python
`;
    }else{
      return [lambdaZipPath] 
    }
    execSync(zipLayerCommand);
    return [lambdaZipPath, lambdaLayerZipPath] 
  } catch (error) {
    core.setFailed(`An error occurred while building Python: ${error.message}`);
  }
}

function buildJavascript(
  lambdaPath,
  lambdaZipPath,
  lambdaLayerZipPath
) {
  try {
    const zipLambdaCommand = ` cd ${lambdaPath}/src
zip -r ${lambdaZipPath} .
`;
    execSync(zipLambdaCommand);

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);

      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.rmSync(`${lambdaPath}/nodejs`, { recursive: true, force: true });
        fs.mkdirSync(`${lambdaPath}/nodejs/node_modules`, { recursive: true });        
        execSync(`mv ${lambdaPath}/node_modules ${lambdaPath}/nodejs/node_modules`)
        execSync(`zip -q -r ${lambdaLayerZipPath} ${lambdaPath}/nodejs/`);
      }
    }else{
      return [lambdaZipPath] 
    }
    execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules`);
    return [lambdaZipPath, lambdaLayerZipPath] 
  } catch (error) {
    core.setFailed(
      `An error occurred while building Javascript: ${error.message}`
    );
  }
}

function buildTypescript(
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

    if (fs.existsSync(`${lambdaPath}/package.json`)) {
      execSync(` cd ${lambdaPath}
npm install --omit=dev
`);
      if (fs.existsSync(`${lambdaPath}/node_modules`)) {
        fs.rmSync(`${lambdaPath}/nodejs`, { recursive: true, force: true });
        fs.mkdirSync(`${lambdaPath}/nodejs/node_modules`, { recursive: true });
        execSync(`mv ${lambdaPath}/node_modules ${lambdaPath}/nodejs/node_modules`)
        execSync(`zip -q -r ${lambdaLayerZipPath} ${lambdaPath}/nodejs/`);
      }
    }else{
      return [lambdaZipPath] 
    }
    execSync(`cd ${lambdaPath} && rm -Rf nodejs node_modules dist`);
    return [lambdaZipPath, lambdaLayerZipPath] 
  } catch (error) {
    core.setFailed(
      `An error occurred while building Typescript: ${error.message}`
    );

  }
}

module.exports = build;
