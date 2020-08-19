'use strict';
const Generator = require('yeoman-generator');
const yaml = require('js-yaml');
const fs = require('fs');
const ConfigLogic = require('./logic/Config');

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);
    this.log('Initializing...');
  }
  start() {
    this.log('Do something...');
    this.prompt([
      {
        type    : 'input',
        name    : 'name',
        message : 'Enter a name for the new component (i.e.: myNewComponent): '
      }
    ]).then(async (answers) => {
      let fileContents = fs.readFileSync('./sample.yml', 'utf8');
      let yaml_config = yaml.safeLoad(fileContents);

      const config = new ConfigLogic(yaml_config);

      await config.serverless_file();

      console.log('logging config', JSON.stringify(config.export(), null, 4));

      this.fs.copyTpl(
        this.templatePath('index.html'),
        this.destinationPath(answers.name + '.html'),
        { message: answers.name}
      );
      console.log('finished!')
    });
  }
};