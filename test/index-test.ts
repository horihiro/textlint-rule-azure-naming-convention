import TextLintTester from "textlint-tester";
import rule from "../src/index";
const BicepProcessor = require ("../../textlint-plugin-bicep/dist/index.js").default;

const tester = new TextLintTester();
// ruleName, rule, { valid, invalid }
tester.run("rule", {
  plugins: [{ pluginId: 'bicep', plugin: BicepProcessor }],
  rules: [{ruleId: 'az-res-naming-convension', rule, 
    options: {
      patterns: {
        "microsoft.web/sites[properties/siteConfig/appSettings[0]/name$=1]": "^web-"
      }
    }}]},
  {
    valid: [
      // no problem
      {
        text:
`resource app'Microsoft.Web/sites@2024-04-01'={
  name: 'web-\${location}-\${test}'
  kind: 'app'
  location: location
  properties: {
    serverFarmId: resourceId('Microsoft.Web/serverfarms', 'myPlan')
    siteConfig: { appSettings: [{ name: 'key1', value: 'value1' }, {}] }
  }
}`,
        ext: ".bicep"
      },
      {
        text:
`resource casandra 'Microsoft.DocumentDB/databaseAccounts@2021-04-01' = {
  name: 'cosgrm-test'
  location: location
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{
      name: 'enablegremlin'
    }]
  }
}`,
        ext: ".bicep"
      },
    ],
    invalid: [
      // single match
      {
        text:
`resource storage 'Microsoft.Storage/storageAccounts@2021-04-01' = {
  name: 'storageaccountname'
  location: location
  properties: {
    accountType: 'Standard_LRS'
  }
  resource blob 'blobServices' = {
    resource container 'containers' = {
      name: 'containername'
    }
    name: 'defaul'
  }
}`,
        ext: ".bicep",
        errors: [
          {
            message: "[Naming violation] The name for 'microsoft.storage/storageaccounts/blobservices' should match by the pattern '^default$'.",
            range: [290, 297]
          }
        ]
      },
    ]
  }
);
