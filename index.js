var fs = require("fs");
var app = require('http').createServer(handler);
var statusCode = 200;

app.listen(443);

function handler (req, res) {
  var data = '';

  if (req.method == "POST") {
    req.on('data', function(chunk) {
      data += chunk;
    });

    req.on('end', function() {
      console.log('Received body data:');
      console.log(data.toString());
	  fs.writeFileSync("postdata", data.toString()+"\n", "UTF-8");
    });
  }

  res.writeHead(statusCode, {'Content-Type': 'text/plain'});
  res.end();
}

console.log("Listening to port 9000");
console.log("Returning status code " + statusCode.toString());