//REQUIRES
var express = require('express'),
bodyParser = require('body-parser'),
app = express(),
im = require('imagemagick'),
fs = require('fs'),
//formidable = require('formidable'),
util = require('util'),
server = require('http').Server(app);

//Newer version of express does not use configure and all middleware dependencies must be install seperately
//app.configure(function(){
  //app.use(express.json());
  //app.use(express.urlencoded());
  //app.use(express.bodyParser());
//});

app.use(bodyParser());
app.use(express.static(__dirname + '/cookbook'));

var router = express.Router(); 

//LOCAL AND SERVER HOST AND POST
var port = (process.env.VMC_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || process.env.OPENSHIFT_NODEJS_IP || 'localhost');

if (process.env.OPENSHIFT_APP_NAME)
{
    console.log('Starting Openshift app: ' + process.env.OPENSHIFT_APP_NAME);
}

//MONGO DB
if(process.env.VCAP_SERVICES){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    console.log(env);
    var mongo = env['mongodb-1.8'][0]['credentials'];
}
else{
    var mongo = {
        "hostname":"localhost",
        "port":27017,
        "username":"",
        "password":"",
        "name":"",
        "db":"db"
    }
}

var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'localhost');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');
    if(obj.username && obj.password){
        return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
    else{
        return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
}

var mongourl = generate_mongo_url(mongo);

//for image manipulation
var spawn = require('child_process').spawn;
var Stream = require('stream');

var socketGlobal = null;

//ROUTES
/*
app.get('/', function(req, res) {
    console.log(formidable);
    //var index = fs.readFileSync('index.html');
    //res.contentType('text/html');
    //res.writeHead(200, {"Content-Type": "text/html"});
    //res.end(index);
});
*/

/* APP SPECIFIC HEADERS */
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8888');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

router.use(function(req, res, next) {
    // do logging
    console.log('Something is happening.');
    next(); // make sure we go to the next routes and don't stop here
});

//Recipe Controller

//get all recipes
app.get('/recipes', function(req, res) {
    recipeService.getAll(req,res);
});

//get recipe by id
app.get('/recipes/:id', function(req, res) {
    recipeService.getById(req, res);
});

//get recipe by cat
app.get('/recipes/byCat/:cat', function(req, res) {
    recipeService.getByCat(req, res);
});

//get recipe by rating
app.get('/recipes/byRating/:rating', function(req, res) {
    recipeService.getByRating(req, res);
});

app.post('/recipes/addNote', function(req, res){
    recipeService.addNote(req, res);
});

app.post('/recipes/deleteNote', function(req, res){
    recipeService.deleteNote(req, res);
});

app.post('/recipes/deleteRecipe', function(req, res){
    recipeService.deleteRecipe(req, res);
});

app.post('/recipes/addRecipe', function(req, res){
    recipeService.addRecipe(req, res);
});

app.get('/deleteNull', function(req, res) {
    delete_nulls();
});


app.get('/send/:mode/:val', function(req, res) {
    
    //res.send("moisture:"+req.body.moisture);
    res.send(req.params.mode + req.params.val);
    if (req.params.mode == "cassera"){
        write_data(req.params.val,res);    
    }
});

app.all('/tropo_step1',function(req, res){
    var tropo = new TropoWebAPI();
    var from = req.body['session']['from']['id'];
    
    io.sockets.emit('initialConnect', { 'from' : from });

    var say = new Say("");
    var choices = new Choices("1,2,3,4");

    // (choices, attempts, bargein, minConfidence, name, recognizer, required, say, timeout, voice);
    tropo.ask(choices, 20, null, null, "digit", null, null, say, 120, null);

    tropo.on("continue", null, "/tropo_continue2?from=" + from, true);
    
    var jsonObj = JSON.parse(tropo["tropo"]["0"]);
    jsonObj.ask.sensitivity = 0.01;
    tropo["tropo"]["0"] = JSON.stringify(jsonObj);
    
    console.log(TropoJSON(tropo));

    res.send(TropoJSON(tropo));
    
    // Render out the JSON for Tropo to consume.
    //res.writeHead(200, {'Content-Type': 'application/json'});
    //res.end(tropowebapi.TropoJSON(tropo));
});

app.post('/tropo_continue1',function(req, res){
    var tropo = new TropoWebAPI();

    var say = new Say("");
    var choices = new Choices("1,2,3,4");

    // (choices, attempts, bargein, minConfidence, name, recognizer, required, say, timeout, voice);
    
    tropo.ask(choices, 20, null, null, "digit", null, null, say, 120, null);
    var from = req.query.from || "some num";
    
    var jsonObj = JSON.parse(tropo["tropo"]["0"]);
    jsonObj.ask.sensitivity = 0.01;
    tropo["tropo"]["0"] = JSON.stringify(jsonObj);

    tropo.on("continue", null, "/tropo_continue2?from=" + from, true);
    var json = TropoJSON(tropo);
    //json[0].tropo[0].ask.sensitivity = 0.01;
    res.send(json);
});

app.post('/tropo_continue2', function(req, res){
    
    if (req.body['result']['actions']['value'] != undefined)
    {   
        var tropo = new TropoWebAPI();
        var answer = req.body['result']['actions']['value'],
            from = req.query.from || "some num2";

        //console.log(util.inspect(res, { showHidden: true, depth: null }));
        //console.log(util.inspect(req, { showHidden: true, depth: null }));

        //Repeat letter back to user
        tropo.say("");
        //tropo.say(answer);
            
        io.sockets.emit('message', { 'resp' : answer, 'from' : req.query.from});

        if (answer != "0"){
            tropo.on("continue", null, "/tropo_continue1?from=" + from, true);
        }
        //console.log(TropoJSON(tropo));
        res.send(TropoJSON(tropo));
    }
 });

var dataTransfer = {
    json : function(res, data)
    {
        res.contentType('application/json');
        res.write(JSON.stringify(data));
        res.end();
    }
};

//Recipe Services

var recipeService = {
    
    /*************************
    /* GET
    /*************************

    /* Get ALl Recipes */
    getAll: function(req, res){
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                coll.find().sort({ recipeId: -1 }, function(err, cursor){
                    cursor.toArray(function(err, items){
                        dataTransfer.json(res,items);
                    });
                });
            });
        });
    },

    getById: function(req, res){
        var id = req.params.id;
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                coll.find({ recipeId: id }, function(err, cursor){
                    cursor.toArray(function(err, items){
                        dataTransfer.json(res,items);
                    });
                });
            });
        });
    },

    getByCat: function(req, res){
        var cat = req.params.cat;
         
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                coll.find({ category: cat }, function(err, cursor){
                    cursor.toArray(function(err, items){
                        dataTransfer.json(res,items);
                    });
                });
            });
        });
    },

    getByRating: function(req, res){
        var rateNum = req.params.rating;
        
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                coll.find({ rating: rateNum }, function(err, cursor){
                    cursor.toArray(function(err, items){
                        dataTransfer.json(res,items);
                    });
                });
            });
        });
    },

    /*************************
    /* POST
    /************************/

    addNote: function(req, res)
    {
        var note = req.body;
        var obj = { date: Date(), text: note.text };
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                if (err == null)
                {
                    coll.update( { recipeId: note.id }, 
                    {$push : { notes: obj }}, function(err, rec) { 
                      
                      var s;
                      if (err == null) {
                        s = {
                                status : 200,
                                resp: obj
                            };
                      }
                      else
                      {
                        s = {
                                status : 500,
                                resp: err
                            };
                      }
                      res.send(JSON.stringify(s));     
                    });
                }
            });
        });
    },


    deleteNote: function(req, res)
    {
        var note = req.body;
        var obj = { date: note.date, text: note.text };
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                if (err == null)
                {
                    coll.update(
                        { recipeId: note.id,
                            notes : obj
                        },
                        { $pull: {
                            notes : obj
                        }}
                    ,function(err, rec) { 
                      
                      var s;
                      if (err == null) {
                        s = {
                                status : 200,
                                resp: obj
                            };
                      }
                      else
                      {
                        s = {
                                status : 500,
                                resp: err
                            };
                      }
                      res.send(JSON.stringify(s));     
                    });
                }
            });
        });
    },

    deleteRecipe: function(req, res)
    {
        var _recipeId = req.body.id;
        require('mongodb').connect(mongourl, function(err, conn){
            conn.collection('recipes', function(err, coll){
                if (err == null)
                {
                    coll.remove(
                        { recipeId: _recipeId }
                    ,function(err, rec) { 
                      
                      var s;
                      if (err == null) {
                        s = {
                                status : 200,
                                resp: _recipeId
                            };
                      }
                      else
                      {
                        s = {
                                status : 500,
                                resp: err
                            };
                      }
                      res.send(JSON.stringify(s));     
                    });
                }
            });
        });
    },


    addRecipe: function(req, res)
    {
        var recipe = req.body;
        console.log('Adding recipe..');
         
            require('mongodb').connect(mongourl, function(err, conn){
                conn.collection('recipes', function(err, coll){
                    if (err == null)
                    {
                        var cursor = coll.find().sort({ recipeId: -1 }).limit(1);
                        cursor.nextObject(function(err,el){
                            var incr = el.recipeId + 1;
                            recipe.recipeId = incr;

                            coll.save(recipe,{safe:true}, function(err, rec){
                              var s;
                              if (err == null) {
                                s = {
                                    status : 200,
                                    resp: recipe.recipeId
                                };
                              }
                              else
                              {
                                s = {
                                    status: 500,
                                    resp : err
                                };
                              }
                              res.send(JSON.stringify(s));
                            });
                        });
                    }
                });
            });
    }

};

exports.cropImage = function(streamIn,dim){
    var command = 'convert';
    // http://www.imagemagick.org/Usage/resize/#space_fill
    var args = [
            "-",                        // use stdin
            "-resize",dim,              // resize as per dimension parameter
            "-"                         // output to stdout
    ];
    var proc = spawn(command, args);
    var stream = new Stream();
    proc.stderr.on('data', stream.emit.bind(stream, 'error'));
    proc.stdout.on('data', stream.emit.bind(stream, 'data'));
    proc.stdout.on('end', stream.emit.bind(stream, 'end'));
    proc.on('error', stream.emit.bind(stream, 'error'));
    streamIn.pipe(proc.stdin);
    console.log("Resized to: " + dim);
    return stream;
};


var delete_nulls = function(){
    /* Connect to the DB and auth */
    require('mongodb').connect(mongourl, function(err, conn){
        conn.collection('plantMoisture', function(err, coll){
             coll.remove({"moisture": "250"});
        });
    });
}

var write_data = function(moisture, res){
    console.log(moisture);
    require('mongodb').connect(mongourl, function(err, conn){
        conn.collection('plantMoisture', function(err, coll){
            /* Simple object to insert: ip address and date */
            object_to_insert = { 'moisture': moisture, 'ts': new Date() };
            
            coll.insert( object_to_insert, {safe:true}, function(err){
                //res.writeHead(200, {'Content-Type': 'text/plain'});
                res.contentType('application/json');
                res.write(JSON.stringify(object_to_insert));
                res.write('\n');
                res.write(mongourl);
                res.end('\n');
            });
        });
    });
}

server.listen(port, host, console.log("started listening... on: " + host + ":" + port));
