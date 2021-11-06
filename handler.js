'use strict';
const Excel = require('exceljs');

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

  return {
    statusCode: 200,
    body: JSON.stringify({"addresses" : addresses, "req" : requirements, "meta" : Array.from(meta)})
    
  }
  
}
