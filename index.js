'use strict';
console.log('Loading COVID response backend');

const aws = require('aws-sdk');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { parse } = require('querystring');

const docClient = new aws.DynamoDB.DocumentClient();
const dynamo = new aws.DynamoDB();

const sendInvite = (email, password) => {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        }
    });

    const htmlBody = `<p>Dear Colleague,</p>
                    <p>At this time every one of us is duplicating work as we develop guidance and advice in a suitable format for our individual practices. As the clinical workload increases, pressure builds on us to keep up to speed and react to the changing situation.</p>
                    <p>Thanks to the effort and expertise of IT specialist Chris Skaaning, we have developed a single storage location for GPs to share information without clogging up their email inboxes. Users are required to log-on with their NHS email address.</p>
                    <p>We have created folders under the following headings: Clinical Protocols, Palliative Care, Patient Advice and Information, Practice Leaflets and Posters, Practice Organisation and Management and Social Services and Third Sector. These can be expanded as the resource builds. </p>
                    <p>To start us off Dr Jocelyn Skaaning and I have uploaded some files to the portal. Users can upload and download files freely. </p>
                    <p>I hope that over time it will become a substantial repository with resources covering all aspects of managing the coronavirus pandemic in primary care and save you valuable time.</p>
                    <p>Clearly every practice does things in their own way. Protocols and advice need to be adapted by each practice to suit their own requirements.  </p>
                    <p>Please note:</p>
                    <ul>
                        <li>This resource is for use by qualified medical professionals only, to share protocols, advice sheets, patient information, administrative procedures etc for use freely by other users of the service</li>
                        <li>Uploaded content <strong>MUST NOT</strong> contain any patient details or data. </li>
                        <li>The facility is provided 'as is' and there is no guarantee of service. </li>
                        <li>It is provided on a free, not for profit basis and it is not affiliated with or endorsed by any NHS body or organisation. </li>
                        <li>The portal is for use by all GP colleagues irrespective of health board area.</li>
                        <li>Anyone using the facility does so at own risk and is responsible for checking the veracity and validity of any information contained therein.</li>
                    </ul>
                    <p>There is no obligation to use this portal however if you do, I hope that you find this a useful resource.</p>
                    <p>Your login details are the following:</p>
                    <p>Email: ${email}</p>
                    <p>Password: ${password}</p>
                    <p>The portal can be found here: <a href="http://gisp.org.uk">http://gisp.org.uk</a></p>
                    <p>Best wishes</p>
                    <p>Dr Stewart Wilkie</p>
                    <p style="margin-top: 0;">Stewarton Medical Practice</p>
                    `;

    var mailOptions = {
        from: 'stewart.wilkie@aapct.scot.nhs.uk',
        to: email,
        subject: 'COVID-19 GP Information Sharing Portal - Invitation',
        html: htmlBody
    };
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                reject(error);
            } else {
                console.log(`Email sent to: ${email} - ${info.response}`);
                resolve('Email sent');
            }
        });
    });
}

const userExists = (tableName, email) => {
    return new Promise((resolve, reject) => {

        const params = {
            Key: {
                "email": {
                    S: email
                }
            },
            TableName: tableName
        }
        console.log("Checking email for existance: ", email);
        dynamo.getItem(params, async (err, res) => {
            console.log("RESULT", err, res);
            if (err) {
                reject(err);
            } else {
                if (res.Item){
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });
};

const generatePasswordHash = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const generatePassword = () => {
    return Math.random().toString(36).slice(-10);
}

const createUser = (tableName, email, password) => {
    return new Promise((resolve, reject) => {
        userExists(tableName, email).then(exists => {
            if (!exists){
                const params = {
                    TableName:tableName,
                    Item:{
                        "email": email,
                        "password": generatePasswordHash(password)
                    }
                };
                console.log(params);
                console.log("Creating new item...");
                docClient.put(params, (err, data) => {
                    if (err) {
                        console.log("ERR: ", err);
                        reject("Unable to create item. Error JSON:", JSON.stringify(err, null, 2), " DATA:", JSON.stringify(data, null, 2));
                    } else {
                        console.log("PutItem succeeded:", JSON.stringify(data, null, 2));

                        sendInvite(email, password).then(() => {
                            resolve(data);
                        });
                    }
                });
            } else {
                console.log("Email already exists:", email);
            }
        });
    });
}

exports.handler = async (event) => {

    const tableName = 'gps';

    let response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: ''
    };

    const promise = new Promise(async (resolve, reject) => {
        const done = (err, res) => {
            if (!err){
                response.body = JSON.stringify(res);
                resolve(response);
            } else {
                response.body = JSON.stringify(err.message);
                response.statusCode = 400;
                reject(response);
            }
        }

        switch (event.httpMethod) {
            case 'POST':
                let buff = new Buffer(event.body, 'base64');
                let inputData = buff.toString('ascii');

                const emails = JSON.parse(inputData);
                console.log(emails);

                const promises = [];
                emails.forEach(async email => {
                    promises.push(createUser(tableName, email.trim(), generatePassword()));
                });

                Promise.all(promises).then(data => {
                    console.log(data);
                    done(null, data);
                }).catch(err => {
                    console.log(err);
                    done(err, null);
                });
                break;
            default:
                done(new Error(`Unsupported method "${event.httpMethod}"`));
        }
    });
    return promise;
};
