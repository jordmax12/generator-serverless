'use strict';
const Generator = require('yeoman-generator');
const YAML = require('yaml');
const fs = require('fs')
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
    ]).then( (answers) => {
      // create destination folder
      // this.destinationRoot(answers.name);
      // p arse config file
      const file = fs.readFileSync('./sample.yml', 'utf8')
      const config = YAML.parse(file)
      console.log('logging config', JSON.stringify(config, null, 4));

      this.fs.copyTpl(
        this.templatePath('index.html'),
        this.destinationPath(answers.name + '.html'),
        { message: answers.name}
      );
      console.log('finished!')
    });
  }
};