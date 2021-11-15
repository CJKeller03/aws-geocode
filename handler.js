'use strict';
const Excel = require('exceljs');
const got = require('got');

module.exports.geocode = async (event) => {

  const ignoreFail = event.headers["Ignore-Failed"];
  const custID = event.headers["Customer-ID"];

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

  let batchSize = 5;
  let coordinates = new Map();
  let fails = [];

  for(let curAddr = 0; curAddr < addresses.length; curAddr += batchSize) {
    let batch = addresses.slice(curAddr, curAddr + batchSize);
    let requestArr = [];

    // Build the required request structure
    batch.forEach((addr, index) => {
      requestArr.push({
        "attributes": {
          "OBJECTID": index,
          "SingleLine": addr
        }
      })
    })

    
    try {
      // send the request to the geocoding server
      const response = await got.post('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/geocodeAddresses', {
        form: {
          "addresses": JSON.stringify({
            "records": requestArr
          })
        },
        responseType: 'json',
        searchParams: {
          'token': 'AAPK9f9894d7f5da40249a238423d36829734dNROM2FV5rVV--7jT1-2e5qM-2St42-TMw9jWfMIqjatsyfclLsVGurAKsbgVcT',
          'f': 'json',
          'outfields': 'none',
          'category': 'Street Address'
        }
      }).json();

      // parse the response into a map
      response.locations.forEach((coord) => {
        if (coord.location !== undefined) {
          coordinates.set(batch[coord.attributes.ResultID], coord.location);
        } else if (ignoreFail) {
          fails.push(batch[coord.attributes.ResultID]);
        }
      })
    } catch (error) {
      return {
        statusCode: 400,
        body: error.message
      }
    }
    
  }

  if (fails.length > 0) {
    return {
      statusCode: 400,
      body: "Unable to find location for: " + JSON.stringify(fails)
    }
  }


  return {
    statusCode: 200,
    body: JSON.stringify(Array.from(coordinates))
    
  }
  
}
