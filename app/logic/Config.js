const yaml = require('js-yaml');
const fs = require('fs');
const path = require("path");
const formatter = require('esformatter');
const { models: default_models, domain: default_domain, type: default_type, app: default_app, service: default_service} = require('./defaults/config');

class Config {
    constructor(config) {
        this._config = {
            app: config.app || default_app,
            service: config.service || default_service,
            type: config.type || default_type,
            domain: config.domain || default_domain,
            custom: config.custom,
            models: config.models || default_models
        };
    }

    get app() {
        const {app} = this._config;
        return app;
    }

    set app(app) {
        this._config.app = app;
    }

    get service() {
        const {service} = this._config;
        return service;
    }

    set service(service) {
        this._config.service = service;
    }

    get type() {
        const {type} = this._config;
        return type;
    }

    set type(type) {
        this._config.type = type;
    }

    get custom() {
        const {custom} = this._config;
        return custom;
    }

    set custom(custom) {
        this._config.custom = custom;
    }

    get models() {
        const {models} = this._config;
        return models;
    }

    set models(models) {
        this._config.models = models;
    }

    jsUcfirst(string) 
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    underscoreToAllCaps(string) {
        return this.jsUcfirst(string.replace(/([-_][a-z])/ig, ($1) => {
            return $1.toUpperCase()
              .replace('-', '')
              .replace('_', '');
          }));
    }

    async create_directory(path) {
        if (!fs.existsSync(path)){
            fs.mkdirSync(path);
        }
    }

    async serverless_file() {
        console.log('logging __dirname', path.join(__dirname, '..'))
        let doc = yaml.safeLoad(fs.readFileSync(`${path.join(__dirname, '..')}/templates/serverless.yml`, 'utf8'));
        doc.app = this._config.app;
        doc.service = this._config.service;
        if (this._config.custom) doc.custom = this._config.custom;
        this.build_directories();
        await this.build_dynamo_db();
        await this.resources();
        await this.controller();
        await this.factories();
        await this.logics();
        // await this.model();

        doc.resources = [];
        doc.resources.push('${file(./aws/resources/dynamodb.yml)}');

        return fs.writeFile('./serverless.yml', yaml.safeDump(doc), (err) => {
            if (err) {
                console.log(err);
            }
            
            Promise.resolve(true);
        });
    }

    async build_directories() {
        const paths = [
            'application',
            'application/v1',
            'application/v1/controller',
            'application/v1/controller/apigateway',
            'application/v1/logic',
            'application/v1/logic/factories',
            'application/v1/model',
            'aws',
            'aws/envs',
            'aws/iamroles',
            'aws/resources'
        ]

        paths.forEach(path => this.create_directory(path))
        // application / v1 / controller
        // application / v1 / controller / apigateway
        // application / v1 / logic
        // application / v1 / logic / factories
        // application / v1 / model
        // aws / envs
        // aws / iamroles
        // aws / resources
    }

    async build_dynamo_db() {
        const { models } = this._config;

        const final = {
            Resources: {}
        }
        for (const [key, value] of Object.entries(models)) {
            const { ddb_config, gets } = value;
            // ddb_config - optional, if none supplied, just make gsi based off of key-id, we will make that the primary key.
            // ddb_config . range - optional the name of the resource (so use the id of that resource)
            // gets - optional array of properties supplied by user to make gsi's
            const resource = {
                Type: 'AWS::DynamoDB::Table',
                Properties: {
                    TableName: `\${self:provider.stackTags.name}-${key}`,
                    BillingMode: 'PAY_PER_REQUEST',
                    StreamSpecification: {
                        StreamViewType: 'NEW_AND_OLD_IMAGES'
                    },
                    PointInTimeRecoverySpecification: {
                        PointInTimeRecoveryEnabled: true
                    },
                    AttributeDefinitions: [{
                        AttributeName: `${key}_id`,
                        AttributeType: 'S'
                    }],
                    KeySchema: [{
                        AttributeName:  `${key}_id`,
                        KeyType: 'HASH'
                    }],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: `${key}_id`,
                            KeySchema: [
                                {
                                    AttributeName: `${key}_id`,
                                    KeyType: 'HASH'
                                }
                            ],
                            Projection: {
                                ProjectionType: 'ALL'
                            }
                        }
                    ]
                }
            }

            if(gets) {
                gets.forEach(getter => {
                    resource.Properties.AttributeDefinitions.push({
                        AttributeName: getter,
                        AttributeType: 'S'
                    });

                    resource.Properties.GlobalSecondaryIndexes.push( {
                        IndexName: `${getter}`,
                        KeySchema: [
                            {
                                AttributeName: `${getter}`,
                                KeyType: 'HASH'
                            }
                        ],
                        Projection: {
                            ProjectionType: 'ALL'
                        }
                    });
                })
            }

            if(ddb_config && ddb_config.range) {
                const find_key_name_range = models[ddb_config.range];
                if(find_key_name_range) {
                    resource.Properties.AttributeDefinitions.push({
                        AttributeName:  `${ddb_config.range}_id`,
                        AttributeType: 'S'
                    });

                    resource.Properties.KeySchema.push({
                        AttributeName:  `${ddb_config.range}_id`,
                        KeyType: 'RANGE'
                    })

                    resource.Properties.GlobalSecondaryIndexes.push({
                        IndexName: `${ddb_config.range}_id`,
                        KeySchema: [
                            {
                                AttributeName: `${ddb_config.range}_id`,
                                KeyType: 'HASH'
                            }
                        ],
                        Projection: {
                            ProjectionType: 'ALL'
                        }
                    });
                }
            }

            final.Resources[this.jsUcfirst(key)] = resource;
          }

        return fs.writeFile('./aws/resources/dynamodb.yml', yaml.safeDump(final), (err) => {
            if (err) {
                console.log(err);
            }

            Promise.resolve(true);
        });
    }

    async resources() {
        // apigateway
        const final = {
            Resources: {}
        }

        const apigateway_stage = {
            ApiGatewayStage: {
            Type: "AWS::ApiGateway::Stage",
            Properties: {
               StageName: "${self:provider.stage}",
               DeploymentId: {
                  Ref: "__deployment__"
               },
               RestApiId: {
                  Ref: "ApiGatewayRestApi"
               },
               MethodSettings: [
                  {
                     ResourcePath: "/*",
                     HttpMethod: "*",
                     LoggingLevel: "INFO",
                     DataTraceEnabled: true,
                     MetricsEnabled: true
                  }
               ]
            }
         }
        }

        const apigateway_base_path_mapping = 
        {
            ApiGatewayPublicBasePathMapping: {
                Type: "AWS::ApiGateway::BasePathMapping",
                Properties: {
                    BasePath: "${self:app}-${self:service}",
                    DomainName: this._config.domain,
                    RestApiId: {
                    Ref: "ApiGatewayRestApi"
                },
                Stage: {
                    Ref: "ApiGatewayStage"
                }
                }
            }
        }

        final.Resources['ApiGatewayStage'] = apigateway_stage;
        final.Resources['ApiGatewayPublicBasePathMapping'] = apigateway_base_path_mapping;

        return fs.writeFile('./aws/resources/apigateway.yml', yaml.safeDump(final), (err) => {
            if (err) {
                console.log(err);
            }

            Promise.resolve(true);
        });
    }

    async controller() {
        const { models } = this._config;
        for(let i = 0; i < Object.keys(models).length; i++) {
            const key = Object.keys(models)[i];
            const model = Object.values(models)[i];
            const { gets, methods } = model;
            let code_template = `const validator = require('../../logic/validator');
            const ${this.jsUcfirst(key)} = require('../../logic/${key}');
            const ${key}Factory = require('../../logic/factories/${key}');

            exports.requirements = {
                post: {
                    requiredBody: 'v1-post-${key}-model'
                },
                patch: {
                    requiredBody: 'v1-patch-${key}-model'
                }
            };
            
            exports.get = async (request, response) => {
                if (validator.isValid${this.jsUcfirst(key)}Request(request, response)) {
                    if(request.params.${key}_id) {
                        const ${key} = await ${key}Factory.getById(request.params.${key}_id)
                        response.body = ${key}.export();
                    }`;

            for(const get of gets) {
                console.log('logging get', get);
                code_template += `else if(request.params.${get}) {
                    const ${key} = await ${key}Factory.getBy${this.underscoreToAllCaps(get)}(request.params.${get})
                    response.body = ${key}.export();
                }`
            }
            code_template += `}};`;
            for(const method of methods) {
                switch(method) {
                    case 'post':
                        code_template += `
                        
                        exports.post = async (request, response) => {
                            const ${key} = new ${this.jsUcfirst(key)}(request.body);
                            try {
                                response.body = await ${key}.create(request.authorizer['x-cognito-username']);
                            } catch (error) {
                                console.log(error);
                                response.code = 400;
                                response.setError('${key}_error', \`There was a problem creating your ${key}: \${error.message}\`);
                            }
                            return response;
                        };`;
                        break;
                    case 'patch':
                        code_template += `
                        
                        exports.patch = async (request, response) => {
                                if (await validator.${key}Exists(request.body.${key}_id, response)) {
                                    const ${key} = await ${key}Factory.getById(request.body.${key}_id);
                                    ${key}.merge(request.body);
                                    try {
                                        response.body = await ${key}.update(request.authorizer['x-cognito-username']);
                                    } catch (error) {
                                        console.log(error);
                                        response.code = 409;
                                        response.setError('data_conflict', \`Failed to update data: \${error.message}\`);
                                    }
                                }
                                return response;
                            };`;
                        break;
                    case 'delete':
                        code_template += `
                        
                        exports.delete = async (request, response) => {
                            if (await validator.${key}Exists(request.params.${key}_id, response)) {
                                await ${key}Factory.remove(request.params.${key}_id, request.authorizer['x-cognito-username']);
                                response.body = undefined;
                            }
                            return response;
                        };`;
                        break;
                    default:
                        break;
                }
            }
            const formatted = formatter.format(code_template);
            
            fs.writeFileSync(`./application/v1/controller/apigateway/${i === 0 ? 'index' : key}.js`, formatted, {encoding:'utf8',flag:'w'}, function(err) {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
        }

        Promise.resolve(true);
    }

    async factories() {
        const { models } = this._config;
        for(let i = 0; i < Object.keys(models).length; i++) {
            const key = Object.keys(models)[i];
            const model = Object.values(models)[i];
            const { gets, ddb_config } = model;
            let code_template = `const ${key}Model = require('../../model/${key}');
            const ${this.jsUcfirst(key)} = require('../${key}');
            `;

            if(ddb_config && ddb_config.range) {
                code_template += `
                exports.getById = async (${key}_id, ${ddb_config.range}_id) => {
                        const result = await ${key}Model.getById(${key}_id, ${ddb_config.range}_id);
                        return new ${this.jsUcfirst(key)}(result);
                };
                `
            } else {
                code_template += `
                exports.getById = async (${key}_id) => {
                        const result = await ${key}Model.getById(${key}_id);
                        return new ${this.jsUcfirst(key)}(result);
                };
                `
            }

            for (const get of gets) {
                code_template += `
                exports.getBy${this.underscoreToAllCaps(get)} = async (${get}_id) => {
                    const result = await ${get}Model.getById(${get}_id);
                    return new ${this.jsUcfirst(get)}(result);
                };`
            }
            const formatted = formatter.format(code_template);
            
            fs.writeFileSync(`./application/v1/logic/factories/${key}.js`, formatted, {encoding:'utf8',flag:'w'}, function(err) {
                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });
            
        }

        Promise.resolve(true);
    }

    async logics() {
        const { models } = this._config;
        for(let i = 0; i < Object.keys(models).length; i++) {
            const key = Object.keys(models)[i];
            console.log('logging key', key);
            const model = Object.values(models)[i];
            const { gets, ddb_config } = model;
            let code_template = `const {v4: uuidv4} = require('uuid');
            const ${key}Model = require('../model/${key}');

            class ${this.jsUcfirst(key)} {
                constructor(${key}) {
                    this._${key} = {
                        ${key}_id: ${key}.${key}_id || uuidv4(),
            `;

            for(const get of gets) {
                code_template += `
                ${get}: ${key}.${get} || '',`
            }

            code_template += `
                    created: ${key}.created || new Date().toISOString(),
                    modified: ${key}.modified || new Date().toISOString()
                };
            }

            get ${key}_id() {
                return this._${key}.${key}_id;
            }
            `

            for(const get of gets) {
                code_template += `
                get ${get}() {
                    return this._${key}.${get};
                }
            
                set ${get}(${get}) {
                    this._${key}.${get} = ${get};
                }
                `
            }

            code_template += `

            get created() {
                return this._company.created;
            }
        
            get modified() {
                return this._company.modified;
            }

            export() {
                return this._${key};
            }
        
            merge(new${this.jsUcfirst(key)}Obj) {
                for (const property in this._${key}) {
                    if (new${this.jsUcfirst(key)}Obj[property]) {
                        this._${key}[property] = new${this.jsUcfirst(key)}Obj[property];
                    }
                }
            }
        
            async create(author_id) {
                const ${key} = await ${key}Model.create(this._${key}, author_id);
                return ${key};
            }
        
            async update(author_id) {
                const originalVersionKey = this._${key}.modified;
                this._${key}.modified = new Date().toISOString();
                const ${key} = await ${key}Model.update(this._${key}, originalVersionKey, author_id);
                return ${key};
            }
        }

        module.exports = ${this.jsUcfirst(key)};`
        console.log('logging code_template', code_template);
        const formatted = formatter.format(code_template);
            
        fs.writeFileSync(`./application/v1/logic/${key}.js`, formatted, {encoding:'utf8',flag:'w'}, function(err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
        }
    }

    async models() {

    }

    async validator() {

    }

    async open_api() {

    }

    async buildspec() {

    }

    async readme() {

    }

    export() {
        return this._config;
    }
}

module.exports = Config;
