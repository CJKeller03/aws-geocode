'use strict';
const Excel = require('exceljs');

module.exports.geocode = async (event) => {

  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(Buffer.from(event.body, 'base64'));

  var str = "";

  workbook.worksheets[0].eachRow(function(row, rowNumber) {
    str += JSON.stringify(row.values) + ", ";
  });

  return {
    statusCode: 200,
    body: str
  };
};
