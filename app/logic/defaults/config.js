exports.app = 'jordans';
exports.service = 'generator';
exports.type = 'node';
exports.domain = 'jordans-serverless-generator.com';
exports.models = {
    employee: {
        ddb_config: {
            range: "employer",
            gsi: [
            "email",
            "phone"
            ]
        },
        methods: [
            "get",
            "post",
            "patch",
            "delete"
        ],
        gets: [
            "email",
            "phone",
            "fortune-five-hundred"
        ],
        schema: [
            "first",
            "last",
            "email",
            "phone"
        ]
    },
    employer: {
        ddb_config: {
            gsi: [
            "email",
            "phone",
            "fortune-five-hundred"
            ]
        },
        methods: [
            "get",
            "post",
            "patch",
            "delete"
        ],
        gets: [
            "email",
            "phone",
            "fortune-five-hundred"
        ],
        schema: [
            "first",
            "last",
            "email",
            "phone",
            "fortune-five-hundred"
        ]
    }
}