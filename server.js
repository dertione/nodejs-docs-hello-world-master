'use strict';
require('./loadConfig.js');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var TYPES = require('tedious').TYPES;

// Create connection to database
var config =
    {
        userName: 'validation', // update me
        password: 'Mbitron71240/*-', // update me
        server: 'validatione2e.database.windows.net', // update me
        options:
            {
                database: 'trame_liveobjects' //update me
                , encrypt: true
            }
    }
var connection = new Connection(config);

  const home = function (request, reply){
      client.query("SELECT * FROM dbo.sigfoxc ORDER BY date DESC")
    .then(res => {
      reply.view('list', {rows:res.rows});
    })
    .catch(e=>console.log(e.stack));
  };

  const uplinkCallback = function (request, reply){
    reply('Callback received').code(200);
    recordCallback('data/uplink', request);
  };

  const downlinkCallback = function (request, reply){
    insertCallback('data/downlink', request)
    .then(res => {
      let recordId = res.rows.pop().id;
      console.log("• New record #",recordId);
      var downlinkData = new Number(recordId).toString(16);
      while (downlinkData.length < 16) downlinkData = "0"+downlinkData;
      reply({
        [request.payload.device] : { "downlinkData" : getDownlinkString(recordId,request.payload.station,request.payload.rssi)}
      }).code(200)
    })
    .catch(err => {
      console.log("An error occurred while handling the downlink callbacks");
      console.log(err.stack);
    })
  };

  const insertCallback = (type, request) => {
    request = new Request("INSERT dbo.sigfoxc (date, callback_type, device, data, stationId, rssi, duplicate) OUTPUT INSERTED.ProductID VALUES (now(), @type, @device, @data, @stationId, @rssi, @duplicate);", function (err) {
        if (err) {
            console.log(err);
        }
    });
    request.addParameter('type', TYPES.VarChar, type);
    request.addParameter('device', TYPES.VarChar, request.payload.device);
    request.addParameter('data', TYPES.VarChar, request.payload.data);
    request.addParameter('stationId', TYPES.VarChar, request.payload.stationId);
    request.addParameter('rssi', TYPES.Float, request.payload.rssi);
    request.addParameter('duplicate', TYPES.Bit, request.payload.duplicate);
    request.on('row', function (columns) {
        columns.forEach(function (column) {
            if (column.value === null) {
                console.log('NULL');
            } else {
                console.log("Product id of inserted item is " + column.value);
            }
        });
    });
    return connection.execSql(request);
  };
  const recordCallback = (type, request) => {
    return insertCallback(type, request)
    .then(res => {
      console.log("• New record #",res.rows.pop().id);
    })
    .catch(err => {
      console.log("SQL Err", err.stack);
    })
  };
  const getDownlinkString = (number, station, rssi) => {
   //Downlink data is 8 Bytes
   //We'll send a number over 2 bytes, the ID of the Sigfox station over 4 bytes, and the received signal strength on this staiton over the last 2 bytes
   var arr = new ArrayBuffer(8);
   var view = new DataView(arr);
   //Bytes 0-1 : number
   view.setUint16(0,number,false); //Start at byte 0, false = Big Endian
   //Bytes 2-5 : station id. Input is an hex string
   view.setUint32(2,parseInt(station,16),false);
   //Bytes 6-7 : rssi (signed int)
   view.setInt16(6,rssi,false);
   var response = [];
   for (var i=0;i<arr.byteLength;i++){
     var byte = view.getUint8(i,false).toString(16);
     if (byte < 0x10) byte = "0"+byte;
     response.push(byte);
   }
   return response.join("");
  };
  server.route({
      method: 'GET',
      path:'/',
      handler: home
  });
  server.route({
      method: 'POST',
      path:'/uplink',
      handler: uplinkCallback
  });
  server.route({
      method: 'POST',
      path:'/downlink',
      handler: downlinkCallback
  });
  server.register(require('vision'), (err) => {
    if (err) throw err;
    server.views({
        engines: {
            html: require('handlebars')
        },
        relativeTo: __dirname,
        path: 'views'
    });
    server.start((err) => {
      if (err) {
          throw err;
      }
      console.log('Server running at:', server.info.uri);
    });
  });
});
