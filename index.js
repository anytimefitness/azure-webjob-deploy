const core = require('@actions/core');
const github = require('@actions/github');
const request = require('request');
const fs = require('fs');
const xml2json = require('xml2json-light');
const StreamZip = require('node-stream-zip');

// Much cribbed from here - https://github.com/srijken/azure-zip-deploy/blob/master/action.yml

try {
  const zipFile = core.getInput('zip-file');
  const publishProfile = core.getInput('publish-profile');
  const type = core.getInput('type');
  if (type != 'continuous' || type != 'triggered') {
    throw `Type must either be 'continuous' or 'triggered'. Found ${type}`;
  }
  const name = core.getInput('name');

  const profile = xml2json.xml2json(publishProfile);
  const msDeployProfile = profile.publishData.publishProfile.find(x => x.publishMethod === 'MSDeploy');

  const userName = msDeployProfile.userName;
  const password = msDeployProfile.userPWD;

  const authHeader = `Basic ${Buffer.from(`${userName}:${password}`).toString('base64')}`;

  const apiUrl = `https://${msDeployProfile.publishUrl}/api/${type}webjobs/${name}`;

  console.log(apiUrl);

  const zip = new StreamZip({
    file: zipFile,
    storeEntries: true
  })
  zip.on('ready', () => {
    console.log('Entries read: ' + zip.entriesCount);
    for (const entry of Object.values(zip.entries())) {
      const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`;
      console.log(`Entry ${entry.name}: ${desc}`);
    }
    // Do not forget to close the file once you're done
    zip.close()
  });

  fs.createReadStream(zipFile).pipe(request.put(apiUrl, {
    headers: {
      Authorization: authHeader
    }
  }));

} catch (error) {
  core.setFailed(error.message);
}