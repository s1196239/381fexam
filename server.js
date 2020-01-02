const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const fs = require('fs');
const formidable = require('formidable');
const mongo = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = 'mongodb+srv://admin:admin@cluster0-13hef.mongodb.net/test?retryWrites=true&w=majority';
const dbName = 'photo';


module.exports = require('./lib/exif');

app.set('view engine','ejs');

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req,res) => {
	res.redirect('/upload');
});

app.get('/upload', (req,res) => {
	res.render("upload.ejs");
});


app.post('/upload', (req,res) => {
	
	let form = new formidable.IncomingForm();
	form.parse(req, (err, fields, files) => {
      console.log(JSON.stringify(files));
      var filename = files.filetoupload.path;
      var title = fields.title;
      var description = fields.description;

      if (files.filetoupload.type) {
        var mimetype = files.filetoupload.type;
        console.log(`mimetype = ${mimetype}`);
      }
      
	
	fs.readFile(filename, (err,data) => {
      let client = new MongoClient(mongourl);
      client.connect((err) => {
        try {
          assert.equal(err,null);
        } catch (err) {
          res.status(500).end("MongoClient connect() failed!");
        }
        const db = client.db(dbName);
        
		var ExifImage = require('./lib/exif').ExifImage;
		
		try {
		    new ExifImage({ image : filename }, function (error, exifData) {
		        if (error)
		            console.log('Error: '+error.message);
		        else
		           // console.log(exifData); // Do something with your data!
		           	var new_r = {};
		           	new_r['title'] = title;
				   	new_r['description'] = description;
		            new_r['make'] = exifData.image.Make;
		            new_r['model'] = exifData.image.Model;
		            new_r['date'] = exifData.image.ModifyDate;
		            new_r['image'] = new Buffer.from(data).toString('base64');		 
		            
		            if(exifData.gps.GPSLatitudeRef=='N'){
			            new_r['lat'] = exifData.gps.GPSLatitude[0] + exifData.gps.GPSLatitude[1]/60 + exifData.gps.GPSLatitude[2]/3600;
		            }else if(exifData.gps.GPSLatitudeRef=='S'){
			            new_r['lat'] = -1 * (exifData.gps.GPSLatitude[0] + exifData.gps.GPSLatitude[1]/60 + exifData.gps.GPSLatitude[2]/3600);
		            }          
		            
		            if(exifData.gps.GPSLongitudeRef=='E'){
			            new_r['lon'] = exifData.gps.GPSLongitude[0] + exifData.gps.GPSLongitude[1]/60 + exifData.gps.GPSLongitude[2]/3600;
		            }else if(exifData.gps.GPSLongitudeRef=='W') {
			            new_r['lon'] = -1 * (exifData.gps.GPSLongitude[0] + exifData.gps.GPSLongitude[1]/60 + exifData.gps.GPSLongitude[2]/3600);
		            }
		            
		            insertPhoto(db,new_r,(result) => {
						console.log(result);
						var id = result.insertedId;
						client.close();
						res.redirect(`/display?_id=${id}`);
        			});
		    });
		} catch (error) {
		    console.log('Error: ' + error.message);
		}
		
      });
	});
  });
});

app.get('/display', (req,res) => {
	
  let client = new MongoClient(mongourl);
  client.connect((err) => {
    try {
      assert.equal(err,null);
    } catch (err) {
      res.status(500).end("MongoClient connect() failed!");
    }      
    console.log('Connected to MongoDB');
    const db = client.db(dbName);
    let criteria = {};
    criteria['_id'] = ObjectID(req.query._id);
    findPhoto(db,criteria,(photo) => {
      client.close();
      console.log('Disconnected MongoDB');
      console.log('Photo returned = ' + photo.length);
      let image = new Buffer(photo[0].image,'base64');     
      console.log(photo[0].mimetype);
      res.render('photo.ejs',{photo:photo});  	  
    });
  });
});

function insertPhoto(db,r,callback) {
  db.collection('photo').insertOne(r,function(err,result) {
    assert.equal(err,null);
    console.log("insert was successful!");
    console.log(JSON.stringify(result));
    callback(result);
  });
}

const findPhoto = (db,criteria,callback) => {
  const cursor = db.collection("photo").find(criteria);
  let photos = [];
  cursor.forEach((doc) => {
    photos.push(doc);
  }, (err) => {
    // done or error
    assert.equal(err,null);
    callback(photos);
  })
}

app.listen(process.env.PORT || 3000, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});