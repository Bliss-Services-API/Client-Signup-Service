module.exports = (postgresClient, S3Object) => {
    const clientSignupController = require('./ClientSignupController')(postgresClient, S3Object);
    const clientMultipartParseController = require('./ClientMultipartParseController')();

    return {
        clientSignupController,
        clientMultipartParseController
    };
}