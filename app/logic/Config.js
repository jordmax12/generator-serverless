const { models: default_models, type: default_type, app: default_app, service: default_service} = require('./defaults/config');

class Config {
    constructor(config) {
        this._config = {
            app: config.app || default_app,
            service: config.service || default_service,
            type: config.type || default_type,
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

    get models() {
        const {models} = this._config;
        return models;
    }

    set models(models) {
        this._config.models = models;
    }

    async serverless_file() {

    }

    async resources() {

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
