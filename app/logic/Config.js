const yaml = require('js-yaml');
const fs = require('fs');
const path = require("path");
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
        this.build_dynamo_db();
        this.resources();

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
            console.log('logging key', key);
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

        // const resource = {
        //     "Resources": {
        //        "ApiGatewayStage": {
        //           "Type": "AWS::ApiGateway::Stage",
        //           "Properties": {
        //              "StageName": "${self:provider.stage}",
        //              "DeploymentId": {
        //                 "Ref": "__deployment__"
        //              },
        //              "RestApiId": {
        //                 "Ref": "ApiGatewayRestApi"
        //              },
        //              "MethodSettings": [
        //                 {
        //                    "ResourcePath": "/*",
        //                    "HttpMethod": "*",
        //                    "LoggingLevel": "INFO",
        //                    "DataTraceEnabled": true,
        //                    "MetricsEnabled": true
        //                 }
        //              ]
        //           }
        //        },
        //        "ApiGatewayPublicBasePathMapping": {
        //           "Type": "AWS::ApiGateway::BasePathMapping",
        //           "Properties": {
        //              "BasePath": "${self:app}-${self:service}",
        //              "DomainName": "${self:provider.stage}-api.syndpe.com",
        //              "RestApiId": {
        //                 "Ref": "ApiGatewayRestApi"
        //              },
        //              "Stage": {
        //                 "Ref": "ApiGatewayStage"
        //              }
        //           }
        //        }
        //     }
        //  }

    }

    async mlc() {

    }

    async factories() {

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
