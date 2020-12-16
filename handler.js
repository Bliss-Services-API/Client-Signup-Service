'use strict';

const fs = require('fs');
const crypto = require(`crypto`);
const controller = require('./controller');
const { S3, PutObjectCommand } = require("@aws-sdk/client-s3");
const postgresConnection = require('./connections/PostgresConnection')('production');

const postgresClient = postgresConnection.authenticate()
                        .then(() => {
                            console.log('Database Connected Successfully');
                            return postgresConnection;
                        })
                        .catch((err) => { 
                            console.log(`ERR: ${err.message}`);
                            return false;
                        });

module.exports.signup = async (event, context) => {
    
    context.callbackWaitsForEmptyEventLoop = false;

    const region = 'us-east-2';
    const S3Client = new S3(region);
    const MagicWord = process.env.MAGIC_WORD;
    const Controller = controller(postgresClient, {S3Client, PutObjectCommand});
    const clientSignupController = Controller.clientSignupController;
    const clientMultipartParseController = Controller.clientMultipartParseController;

    let clientImageFilePath;

    try {
        if(postgresClient) {
            
            const clientData = await clientMultipartParseController(event);

            const clientEmail = clientData.body.email;

            if(clientEmail === `undefined`) {
                const response = {
                    ERR: `No Email Provided`,
                    CODE: 'NO_EMAIL_FOUND'
                };

                return {
                    statusCode: 200,
                    body: JSON.stringify(response)
                };
            };

            const clientEmailSalted = clientEmail + "" + MagicWord;
            const clientId = crypto.createHash('sha256').update(clientEmailSalted).digest('base64');
            const currTime = new Date().getTime();
            const clientCategory = clientData.body.client_category;
            const clientName = clientData.body.client_name;
            const clientPassword = clientData.body.client_password;
            const clientDOB = clientData.body.client_category;
            const clientContactNumber = clientData.body.client_category;
            const clientOriginCountry = clientData.body.client_category;
            const clientBio = clientData.body.client_category;

            clientImageFilePath = clientData.files.filePath;
            const clientImageFileStream = fs.createReadStream(clientData.files.filePath);
            const clientImageFileName = clientData.files.fileName;
            const clientImageMIMEType = clientData.file.contentType;

            const imageExists = await clientSignupController.checkClientImageExist(clientImageFileName);
            const profileExists = await clientSignupController.checkClientProfileExists(clientId);

            if(!imageExists && !profileExists) {
                await clientSignupController.uploadClientImage(clientImageFileStream, clientImageFileName, clientImageMIMEType);
                await clientSignupController.uploadClientProfileData(clientId, clientCategory, clientDOB, clientContactNumber, clientOriginCountry, clientBio);
                await clientSignupController.uploadClientCredentials(clientId, clientEmail, clientName, clientPassword);
                await clientSignupController.createStripeCustomer(clientName, clientId, clientContactNumber, clientEmail);

                const tokenPayload = {
                    CLIENT_ID: clientId,
                    REVOKE_TIME: currTime
                };

                const token = clientSignupController.generateToken(tokenPayload);

                const response = {
                    MESSAGE: 'DONE',
                    RESPONSE: `Client Registered Successfully`,
                    CODE: 'CLIENT_REGISTERED',
                    EXPIRE: '1d'
                };

                return {
                    statusCode: 200,
                    headers: {
                        'Cookie': token
                    },
                    body: JSON.stringify(response)
                };
            }
            else if(imageExists){
                throw new Error('Client Profile Image Already Exists');
            }
            else {
                throw new Error('Client Already Registered Exists');
            }
        }
    }
    catch(err) {
        console.error(`ERR: ${err.message}`);

        const response = {
            ERR: err.message,
            RESPONSE: `Client Couldn't be Sign Up`,
            CODE: 'CLIENT_SIGNUP_ERROR'
        };

        return {
            statusCode: 400,
            body: JSON.stringify(response)
        };

    } finally {
        if(clientImageFilePath)
            fs.unlinkSync(clientImageFilePath);
    }
}