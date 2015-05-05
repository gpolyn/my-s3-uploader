var request = require('request');
var AWS = require('aws-sdk');
var knox = require('knox');
var gm = require('gm').subClass({imageMagick: true});
var async = require('async');

var s3 = new AWS.S3();

var S3Uploader = function (config) {
  this.knoxClient = knox.createClient({
    key: config.key, 
    secret: config.secret, 
    bucket: config.bucket,
    region: config.region
  });
  this.s3Bucket = config.bucket;
  AWS.config.update({
    accessKeyId: config.key,
    secretAccessKey: config.secret,
    region: config.region,
  });

  this.s3 = new AWS.S3(); 
}

S3Uploader.prototype.upload = function (targetUri, done) {

  var self = this;

  request.get(targetUri).on('response', function(res) {

    if (res.statusCode !=200){
      console.log("Error in retreiving specified target")
    } else {
      async.parallel([
        function (cb){
          putImageAsIs(res, targetUri, self.knoxClient, cb);
        },
        function (cb){
          resizeImage(res,targetUri, self.s3, self.s3Bucket,150,150,"thumb", cb); 
        },
        function (cb){
          resizeImage(res,targetUri, self.s3, self.s3Bucket,350,350,"medium", cb); 
        }
      ], done);
    }
  });
};

var resizeImage = function(res,url, awsClient, s3Bucket, ht, width, suffix, cb) {
  console.log("endpoint for s3...");
  console.log(awsClient.endpoint)
  gm(res).resize(ht, width, '^').gravity('Center').extent(ht, width).quality(80).stream(function(err, stdout, stderr) {
    if (err) {
      cb(err);
    } else {

      var buf = new Buffer(0);

      stdout.on('data', function(d) {
        buf = Buffer.concat([buf, d]);
      });

      stdout.on('end', function() {
        var key = url.substr(url.lastIndexOf("/")+1) + ":" + suffix;
        var data = {
          ACL: 'public-read',
          Bucket: s3Bucket,
          Key: key,
          Body: buf
        };
        awsClient.putObject(data, function(err, resp) {
          if (err) {
            console.log(err)
          } else {
            cb(null, awsClient.endpoint.href + s3Bucket + "/" + key );
          }
        });
      });
    }
  });
}

var putImageAsIs = function(res, targetUri, knoxClient, cb) {
  console.log("knox client...")
  console.log(knoxClient.url(''))
  var headers = {
      'Content-Length': res.headers['content-length']
    , 'Content-Type': res.headers['content-type']
    , 'x-amz-acl': 'public-read'
  };

  var key = targetUri.substr(targetUri.lastIndexOf("/") + 1);

  knoxClient.putStream(res, key, headers, function(err, res){
    if (err) {
      cb(err);
    } else {
      cb(null, knoxClient.url('') + key);
    }
  });
}

exports.S3Uploader = S3Uploader;
