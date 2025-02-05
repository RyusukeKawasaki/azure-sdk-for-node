/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 */

/* jshint latedef:false */
/* jshint forin:false */
/* jshint noempty:false */

'use strict';
const msRest = require('ms-rest');
const msRestAzure = require('ms-rest-azure');

const ServiceClient = msRestAzure.AzureServiceClient;
const WebResource = msRest.WebResource;

const models = require('./models');
const jwk = require('./jwk');
const objId = require('./objectIdentifier');

/** Identifier of the resource on which Key Vault users and service principals must authenticate.
 */
exports.RESOURCE_ID = 'https://vault.azure.net';

// The internal client is too low level, so we wrap it instead of exposing it directly.
const KeyVaultClientBase = require('./keyVaultClient');


/**
 * Gets the certificate operation response.
 *
 * @param {string} vaultBaseUrl The vault name, e.g.
 * https://myvault.vault.azure.net
 * 
 * @param {string} certificateName The name of the certificate
 * 
 * @param {object} [options] Optional Parameters.
 * 
 * @param {object} [options.customHeaders] Headers that will be added to the
 * request
 * 
 * @param {function} callback
 *
 * @returns {function} callback(err, result, request, response)
 *
 *                      {Error}  err        - The Error object if an error occurred, null otherwise.
 *
 *                      {object} [result]   - The deserialized result object.
 *                      See {@link CertificateOperation} for more information.
 *
 *                      {object} [request]  - The HTTP Request object if an error did not occur.
 *
 *                      {stream} [response] - The HTTP Response stream if an error did not occur.
 */
function _getPendingCertificateSigningRequest(vaultBaseUrl, certificateName, options, callback) {
  /* jshint validthis: true */
  let client = this;
  if (!callback && typeof options === 'function') {
    callback = options;
    options = null;
  }
  if (!callback) {
    throw new Error('callback cannot be null.');
  }
  // Validate
  try {
    if (vaultBaseUrl === null || vaultBaseUrl === undefined || typeof vaultBaseUrl.valueOf() !== 'string') {
      throw new Error('vaultBaseUrl cannot be null or undefined and it must be of type string.');
    }
    if (certificateName === null || certificateName === undefined || typeof certificateName.valueOf() !== 'string') {
      throw new Error('certificateName cannot be null or undefined and it must be of type string.');
    }
    if (client.apiVersion === null || client.apiVersion === undefined || typeof client.apiVersion.valueOf() !== 'string') {
      throw new Error('this.apiVersion cannot be null or undefined and it must be of type string.');
    }
    if (client.acceptLanguage !== null && client.acceptLanguage !== undefined && typeof client.acceptLanguage.valueOf() !== 'string') {
      throw new Error('this.acceptLanguage must be of type string.');
    }
  } catch (error) {
    return callback(error);
  }

  // Construct URL
  let requestUrl = client.baseUri +
    '//certificates/{certificate-name}/pending';
  requestUrl = requestUrl.replace('{vaultBaseUrl}', vaultBaseUrl);
  requestUrl = requestUrl.replace('{certificate-name}', encodeURIComponent(certificateName));
  let queryParameters = [];
  queryParameters.push('api-version=' + encodeURIComponent(client.apiVersion));
  if (queryParameters.length > 0) {
    requestUrl += '?' + queryParameters.join('&');
  }
  // trim all duplicate forward slashes in the url
  let regex = /([^:]\/)\/+/gi;
  requestUrl = requestUrl.replace(regex, '$1');

  // Create HTTP transport objects
  let httpRequest = new WebResource();
  httpRequest.method = 'GET';
  httpRequest.headers = {};
  httpRequest.url = requestUrl;
  // Set Headers
  if (client.generateClientRequestId) {
    httpRequest.headers['x-ms-client-request-id'] = msRestAzure.generateUuid();
  }
  if (client.acceptLanguage !== undefined && client.acceptLanguage !== null) {
    httpRequest.headers['accept-language'] = client.acceptLanguage;
  }
  if (options) {
    for (let headerName in options['customHeaders']) {
      if (options['customHeaders'].hasOwnProperty(headerName)) {
        httpRequest.headers[headerName] = options['customHeaders'][headerName];
      }
    }
  }
  httpRequest.headers['Content-Type'] = 'application/json; charset=utf-8';
  httpRequest.headers['Accept'] = 'application/pkcs10';
  httpRequest.body = null;
  // Send Request
  return client.pipeline(httpRequest, function (err, response, responseBody) {
    if (err) {
      return callback(err);
    }
    let statusCode = response.statusCode;
    if (statusCode !== 200) {
      let error = new Error(responseBody);
      error.statusCode = response.statusCode;
      error.request = msRest.stripRequest(httpRequest);
      error.response = msRest.stripResponse(response);
      if (responseBody === '') responseBody = null;
      let parsedErrorResponse;
      try {
        parsedErrorResponse = JSON.parse(responseBody);
        if (parsedErrorResponse) {
          let internalError = null;
          if (parsedErrorResponse.error) internalError = parsedErrorResponse.error;
          error.code = internalError ? internalError.code : parsedErrorResponse.code;
          error.message = internalError ? internalError.message : parsedErrorResponse.message;
        }
        if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
          let resultMapper = new client.models['KeyVaultError']().mapper();
          error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
        }
      } catch (defaultError) {
        error.message = `Error "${defaultError.message}" occurred in deserializing the responseBody ` +
          `- "${responseBody}" for the default response.`;
        return callback(error);
      }
      return callback(error);
    }
    // Create Result
    let result = null;
    if (responseBody === '') responseBody = null;
    // Deserialize Response
    if (statusCode === 200) {
      result = responseBody;
    }

    return callback(null, result, httpRequest, response);
  });
}

/**
 * @class
 * Initializes a new instance of the KeyVaultClient class.
 * @constructor
 *
 * @param {credentials} credentials - Credentials needed for the client to connect to Azure.
 *
 * @param {object} [options] - The parameter options
 *
 * @param {Array} [options.filters] - Filters to be added to the request pipeline
 *
 * @param {object} [options.requestOptions] - Options for the underlying request object
 * {@link https://github.com/request/request#requestoptions-callback Options doc}
 *
 * @param {boolean} [options.noRetryPolicy] - If set to true, turn off default retry policy
 *
 * @param {string} [options.apiVersion] - Client Api Version.
 *
 * @param {string} [options.acceptLanguage] - Gets or sets the preferred language for the response.
 *
 * @param {number} [options.longRunningOperationRetryTimeout] - Gets or sets the retry timeout in seconds for Long Running Operations. Default value is 30.
 *
 * @param {boolean} [options.generateClientRequestId] - When set to true a unique x-ms-client-request-id value is generated and included in each request. Default is true.
 *
 */
class KeyVaultClient extends KeyVaultClientBase {

  constructor(credentials, options) {
    // convert credentials to KeyVaultCredentials if needed
    let keyVaultCredentials = credentials;
    if (!(_isKeyVaultCredentials(credentials))) {
      keyVaultCredentials = new msRestAzure.KeyVaultCredentials(null, credentials);
    }

    // create and add new custom filter before calling super()
    if (keyVaultCredentials.createSigningFilter) {
      if (!options) options = [];
      if (!options.filters) options.filters = [];
      options.filters.push(keyVaultCredentials.createSigningFilter());
    }

    // ServiceClient constructor adds filter to the pipeline
    super(keyVaultCredentials, options);
    this._getPendingCertificateSigningRequest = _getPendingCertificateSigningRequest;
  }

  /**
   * Gets the certificate operation response.
   *
   * @param {string} vaultBaseUrl The vault name, e.g.
   * https://myvault.vault.azure.net
   * 
   * @param {string} certificateName The name of the certificate
   * 
   * @param {object} [options] Optional Parameters.
   * 
   * @param {object} [options.customHeaders] Headers that will be added to the request
   * 
   * @returns {Promise} A promise is returned
   *
   * @resolve {HttpOperationResponse<CertificateListResult>} - The deserialized result object.
   *
   * @reject {Error} - The error object.
   */
  getPendingCertificateSigningRequestWithHttpOperationResponse(vaultBaseUrl, certificateName, options) {
    let self = this;
    return new Promise((resolve, reject) => {
      self._getPendingCertificateSigningRequest(vaultBaseUrl, certificateName, options, (err, result, request, response) => {
        let httpOperationResponse = new msRest.HttpOperationResponse(request, response);
        httpOperationResponse.body = result;
        if (err) { reject(err); }
        else { resolve(httpOperationResponse); }
        return;
      });
    });
  }

  /**
   * Gets the certificate operation response.
   *
   * @param {string} vaultBaseUrl The vault name, e.g.
   * https://myvault.vault.azure.net
   * 
   * @param {string} certificateName The name of the certificate
   * 
   * @param {object} [options] Optional Parameters.
   * 
   * @param {object} [options.customHeaders] Headers that will be added to the
   * request
   * 
   * @param {function} [optionalCallback] - The optional callback.
   *
   * @returns {function|Promise} If a callback was passed as the last parameter
   * then it returns the callback else returns a Promise.
   *
   * {Promise} A promise is returned
   *
   *                      @resolve {CertificateOperation} - The deserialized result object.
   *
   *                      @reject {Error} - The error object.
   *
   * {function} optionalCallback(err, result, request, response)
   *
   *                      {Error}  err        - The Error object if an error occurred, null otherwise.
   *
   *                      {object} [result]   - The deserialized result object if an error did not occur.
   *                      See {@link CertificateOperation} for more information.
   *
   *                      {object} [request]  - The HTTP Request object if an error did not occur.
   *
   *                      {stream} [response] - The HTTP Response stream if an error did not occur.
   */
  getPendingCertificateSigningRequest(vaultBaseUrl, certificateName, options, optionalCallback) {
    let self = this;
    if (!optionalCallback && typeof options === 'function') {
      optionalCallback = options;
      options = null;
    }
    if (!optionalCallback) {
      return new Promise((resolve, reject) => {
        self._getPendingCertificateSigningRequest(vaultBaseUrl, certificateName, options, (err, result, request, response) => {
          if (err) { reject(err); }
          else { resolve(result); }
          return;
        });
      });
    } else {
      return self._getPendingCertificateSigningRequest(vaultBaseUrl, certificateName, options, optionalCallback);
    }
  }
}

/**
 * @private
 * 
 * It is possible for multiple instances of msRestAzure to exist. This method adds a backup check in case "instanceof" returns false.
 * 
 * @param {object} credentials
 */
function _isKeyVaultCredentials(credentials) {
  return credentials instanceof msRestAzure.KeyVaultCredentials || msRestAzure.KeyVaultCredentials.name === credentials.constructor.name;
}

/**
 * Creates a new {@linkcode KeyVaultClient} object.
 *
 * @param {object} [credentials]     The credentials, typically a {@linkcode msRestAzure.KeyVaultCredentials} object. If null, an authentication filter must be provided.
 
 * @param {object} [options] - The parameter options
 *
 * @param {Array} [options.filters] - Filters to be added to the request pipeline
 *
 * @param {object} [options.requestOptions] - Options for the underlying request object
 * {@link https://github.com/request/request#requestoptions-callback Options doc}
 *
 * @param {boolean} [options.noRetryPolicy] - If set to true, turn off default retry policy
 *
 * @param {string} [options.apiVersion] - Client Api Version.
 *
 * @param {string} [options.acceptLanguage] - Gets or sets the preferred language for the response.
 *
 * @param {number} [options.longRunningOperationRetryTimeout] - Gets or sets the retry timeout in seconds for Long Running Operations. Default value is 30.
 *
 * @param {boolean} [options.generateClientRequestId] - When set to true a unique x-ms-client-request-id value is generated and included in each request. Default is true.
 *
 */
module.exports.createKeyVaultClient = function createKeyVaultClient(credentials, options) {
  return new module.exports.KeyVaultClient(credentials, options);
};

module.exports.KeyVaultClient = KeyVaultClient;
module.exports.JsonWebKeyEncryptionAlgorithms = jwk.JsonWebKeyEncryptionAlgorithms;
module.exports.JsonWebKeySignatureAlgorithms = jwk.JsonWebKeySignatureAlgorithms;
module.exports.KeyVaultCredentials = msRestAzure.KeyVaultCredentials;
module.exports.parseKeyIdentifier = objId.parseKeyIdentifier;
module.exports.createSecretIdentifier = objId.createSecretIdentifier;
module.exports.createKeyIdentifier = objId.createKeyIdentifier;
module.exports.parseSecretIdentifier = objId.parseSecretIdentifier;
module.exports.createCertificateIdentifier = objId.createCertificateIdentifier;
module.exports.parseCertificateIdentifier = objId.parseCertificateIdentifier;
module.exports.createCertificateOperationIdentifier = objId.createCertificateOperationIdentifier;
module.exports.parseCertificateOperationIdentifier = objId.parseCertificateOperationIdentifier;
module.exports.createIssuerIdentifier = objId.createIssuerIdentifier;
module.exports.parseIssuerIdentifier = objId.parseIssuerIdentifier;
module.exports.Models = models;
module.exports.msRestAzure = msRestAzure;
