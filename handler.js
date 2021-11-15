'use strict';
const Excel = require('exceljs');
const got = require('got');

module.exports.geocode = async (event) => {

  var reader;
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
  var addresses;
  var requirements;
  var meta = new Map();

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

  var coordinates = [];
  var batchSize = 5;

  for(let curAddr = 0; curAddr < addresses.length; curAddr += batchSize) {
    var batch = addresses.slice(curAddr, curAddr + batchSize);
    var requestArr = [];
    batch.forEach((addr, index) => {
      requestArr.push({
        "attributes": {
          "OBJECTID": curAddr + index,
          "SingleLine": addr
        }
      })
    })

    
    try {
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
          'outfields': 'none'
        }
      }).json();
      coordinates.push(...response.locations);
    } catch (error) {
      coordinates.push(error);
    }
    
  }


  return {
    statusCode: 200,
    body: JSON.stringify(coordinates)
    
  }
  
}
