'use strict';

module.exports = (postgresClient, S3Object) => {
    
    const fs = require('fs');
    const path = require('path');
    const jwt = require('jsonwebtoken');
    const model = require('../models');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_API_KEY);

    const Models = model(postgresClient);
    const clientCredentialModel = Models.ClientCredentialModel;
    const clientProfileModel = Models.ClientProfileModel;
    const clientImageBucket = process.env.CLIENT_IMAGE_BUCKET;

    const generateToken = (payload) => {
        const privateKeyPath = path.join(__dirname, "../private/twilight_ecc_private_key.pem")
        const twilightPrivateKey = fs.readFileSync(privateKeyPath);
        
        const token = jwt.sign(payload, twilightPrivateKey, {
                    algorithm: 'ES512',
                    expiresIn: "1d",
                    notBefore: new Date().getTime(),
                    issuer: 'Bliss LLC.',
                    mutatePayload: true
                });
    
        return token;
    };

    const uploadClientImage = async (imageStream, imageFileName, imageMIMEType) => {
        const imageParam = { 
            Bucket: clientImageBucket,
            Key: imageFileName,
            Body: imageStream,
            ContentType: imageMIMEType
        };

        await S3Object.S3.send(new S3Object.S3.PutObjectCommand(imageParam));
        return true;
    };

    const uploadClientProfileData = async (clientId, clientCategory, clientDOB, clientContactNumber, clientOriginCountry, clientBio) => {
        const currTime = new Date().getTime();
        const clientData = {};

        clientData['client_id'] = clientId;
        clientData['client_category'] = clientCategory;
        clientData['client_dob'] = clientDOB;
        clientData['client_contact_number'] = clientContactNumber;
        clientData['client_origin_country'] = clientOriginCountry;
        clientData['client_bio'] = clientBio;
        clientData['client_profile_image_link'] = `${clientId}.png`;
        clientData['client_joining_date'] = currTime;
        clientData['client_update_date'] = currTime;

        await clientProfileModel.create(clientData);
        return true;
    };
    
    const uploadClientCredentials = async (clientId, clientEmail, clientName, clientPassword) => {
        const clientCredentialData = {};

        clientCredentialData['client_id'] = clientId;
        clientCredentialData['client_email'] = clientEmail;
        clientCredentialData['client_name'] = clientName;
        clientCredentialData['client_password'] = clientPassword;

        await clientCredentialModel.create(clientCredentialData);
        return true;
    };

    const checkClientImageExist = async imageFileName => {
        const imageParam = {
            Bucket: clientImageBucket,
            Key: imageFileName
        };

        return new Promise((resolve, reject) => {
            try {
                S3Object.headObject(imageParam, (err, metadate) => {
                    if(err && err.statusCode === 404) {
                        return resolve(false);
                    } else if(err) {
                        return reject(err);
                    }else {
                        return resolve(true);
                    }
                });
            } catch(err) {
                return reject(err);
            };
        })
    };

    const checkClientProfileExists = async clientId => {
        const clientProfile = await clientProfileModel.findAll({ where: { client_id: clientId } });
        return (clientProfile.length !== 0);
    };

    const createStripeCustomer = async (clientName, clientId, clientContactNumber, clientEmail) => {
        const customer = await stripe.customers.create({
            id: clientId,
            email: clientEmail,
            phone: clientContactNumber, 
            name: clientName
        });

        console.log(customer);
        
        return true;
    };

    return {
        generateToken,
        uploadClientImage,
        uploadClientProfileData,
        uploadClientCredentials,
        checkClientImageExist,
        checkClientProfileExists,
        createStripeCustomer
    };
}