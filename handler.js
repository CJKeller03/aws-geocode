'use strict';
const Excel = require('exceljs');
const got = require('got');

const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");

const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`.
  convertEmptyValues: false, // false, by default.
  // Whether to remove undefined values while marshalling.
  removeUndefinedValues: false, // false, by default.
  // Whether to convert typeof object to map attribute.
  convertClassInstanceToMap: true, // false, by default.
};

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false, // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };

const ddbClient = DynamoDBDocument.from(new DynamoDB({}), translateConfig);

const tableName = process.env.TABLE_NAME;
const ARCGIS_KEY = process.env.ARCGIS_KEY;

function put(custID, projID, map) {
  //console.log(custID + " " + projID);
  ddbClient.put({
      TableName: tableName,
      Item: {
        custID: custID,
        projID: projID,
        coordinateMap: map,
        expiration: Math.floor(Date.now() / 1000) + 300
      }
  });
}

function get(custID, projID) {
  //console.log(custID + " " + projID);
  return ddbClient.get({
      TableName: tableName,
      Key: {
        custID: custID,
        projID: projID
      },
      ProjectionExpression: "coordinateMap"
  });
}

module.exports.geocode = async (event) => {

  const ignoreFail = event.headers["ignore-failed"];
  const custID = event.headers["customer-id"];
  const projID = event.headers["project-id"];

  if (custID == undefined || projID == undefined) {
    return {
      statusCode: 400,
      body: "Missing customer or project ID"
    }
  }

  let reader;
  switch(event.headers["content-type"]) {
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      reader = new Excel.Workbook();
      await reader.xlsx.load(Buffer.from(event.body, 'base64'));
    }
    break;

    case "text/csv": {
      reader = new Excel.Workbook();
      await reader.csv.read(event.body);
    }
    break;

    default: {
      return {
        statusCode: 500,
        body: "Unable to read file"
      }
    }
  }
  
  const sheet = reader.worksheets[0];
  let addresses;
  let requirements;
  let meta = new Map();

  sheet.getRow(1).eachCell(function(cell, colNumber) {
    switch (cell.value.toLowerCase()) {
      case "address": {
        addresses = sheet.getColumn(colNumber).values.slice(2);
        break;
      }
      case "request": {
        requirements = sheet.getColumn(colNumber).values.slice(2);
        break;
      }
      default: {
        meta.set(cell.value, sheet.getColumn(colNumber).values.slice(2));
      }
    }
  });

  if (addresses == undefined || requirements == undefined) {
    return {
      statusCode: 400,
      body: "Address or Request field missing"
    }
  }

  let fails = [];

  var tmp = await get(custID, projID);
  let coordMap = tmp.Item == undefined? {}: tmp.Item.coordinateMap;

  await Promise.all(addresses.filter(addr => !coordMap.hasOwnProperty(addr)).map(async (addr) => {
    // send the request to the geocoding server
    let res = await got.get('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates', {
      responseType: 'json',
      searchParams: {
        'token': ARCGIS_KEY,
        'f': 'json',
        'outfields': 'none',
        'forStorage': 'false',
        'address': addr,
        'category': 'Point Address, Street Address'
      }
    }).json();

    let loc = res.candidates[0].location;
    if (loc != undefined) {
      coordMap[addr] = loc;
    } else {
      fails.push(addr);
    }
  }));

  if (fails.length > 0 && !ignoreFail) {
    return {
      statusCode: 400,
      body: "Unable to find location for: " + JSON.stringify(fails)
    }
  }

  put(custID, projID, coordMap);

  return {
    statusCode: 200,
    body: JSON.stringify(coordMap)
  }
  
}
