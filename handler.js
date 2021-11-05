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

  reader.worksheets[0].columns = [
    {header: 'address', key: 'Address'},
    {header: "name", key: "Name"},
    {header: "request", key: "Request"}
  ];

  var addresses = reader.worksheets[0].getColumn("Address").values;
  var requirement = reader.worksheets[0].getColumn("Request").values;
  var meta = [];

  return {
    statusCode: 200,
    body: JSON.stringify({"addresses" : addresses, "req" : requirement})
  }
  
}
