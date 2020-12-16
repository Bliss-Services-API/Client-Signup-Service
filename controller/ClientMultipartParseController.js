'use strict';

/**
 * 
 * Controller for parsing the multipart/form-data sent from the API Gateway Proxy server
 * 
 */
module.exports = () => {
    const Busboy = require('busboy');
    const fs = require('fs');
    const path = require('path');

    return (event) => {
        return new Promise((resolve, reject) => {

            if(event.headers['Content-Type'] === 'undefined' && event.headers['content-type'] === 'undefined')
                return reject('Content Type Undefined');
            
            const busboy = new Busboy({
                headers: {
                    'content-type': event.headers['content-type'] || event.headers['Content-Type']
                },
                limit: {
                    files: 1, 
                    fileSize: 10000
                }
            });
        
            const result = {
                body: {},
                files: {}
            };

            busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
                
                const clientImagePath = path.join(__dirname, `../tmp/client-images/${filename}`);
                file.pipe(fs.createWriteStream(clientImagePath));
                
                const uploadFile = {};

                file.on('end', () => {
                    uploadFile.filePath = clientImagePath
                    uploadFile.fileName = filename;
                    uploadFile.contentType = mimetype;
                    uploadFile.encoding = encoding;
                    uploadFile.fieldName = fieldname;
                    result.files = uploadFile;
                });
            });

            busboy.on('field', (fieldname, value) => {
                result.body[fieldname] = value;
            });

            busboy.on('error', error => {
                reject(error);
            });

            busboy.on('finish', () => {
                resolve(result);
            });

            busboy.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
            busboy.end();
        })
    };
}