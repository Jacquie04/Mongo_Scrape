require('dotenv').config()
var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
var axios = require("axios");
var cheerio = require("cheerio");
var app = express();
var exphbs = require("express-handlebars");

mongoose.Promise = Promise;

// Require all models
var db = require("./models");

var port = process.env.PORT || 3000;

// Initialize Express
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Use morgan logger for logging requests
app.use(logger("dev"));



// Connect to the Mongo DB
var databaseUri = "mongodb://localhost/Mongo_Scrape"

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
 } else {
   mongoose.connect(databaseUri);
 }

var dbm = mongoose.connection;

dbm.on('error', function(err) {
   console.log('Mongoose Error: ', err);
 });

 dbm.once('open', function() {
   console.log('Mongoose connection successful.');
 });




 app.get("/", function(req, res) {
	db.Article.find({"saved": false}, function(err, data) {
			res.render("index", {articles: data});
		})
  });
  
  app.get("/saved", function(req, res) {
    // Grab every document in the Articles collection
    db.Article.find({"saved": true})
      .then(function(err, articles) {
        res.render("index", {articles: data});
      });
  });


app.get("/scrape", function(req, res) {

  axios.get("http://www.echojs.com/").then(function(response) {
   
    var $ = cheerio.load(response.data);

    console.log("scraping log")
    // console.log(response.data)
    $("article h2").each(function(i, element) {
      // Save an empty result object
      var result = {};
      console.log("scraping in each")
      console.log($(this).children().text());

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("a")
        .text().trim();
      result.link = $(this)
        .children("a")
        .attr("href");
      result.summary = $(this)
      .find("p.summary")
      .text()
      .trim();

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, log it
          console.log(err);
        }); 
    });

    // Send a message to the client
    
    res.send("scrape complete");
    res.redirect("/articles");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/save/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});


// Delete an article
app.post("/articles/delete/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  db.Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  // Execute the above query
  .exec(function(err, dbArticle) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      // Or send the document to the browser
      res.send(dbArticle);
    }
  });
});


// Create a new note
app.post("/notes/save/:id", function(req, res) {
// Create a new note and pass the req.body to the entry
var newNote = new Note({
body: req.body.text,
article: req.params.id
});
console.log(req.body)
// And save the new note the db
newNote.save(function(error, note) {
// Log any errors
if (error) {
  console.log(error);
}
// Otherwise
else {
  // Use the article id to find and update it's notes
  db.Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
  // Execute the above query
  .exec(function(err) {
    // Log any errors
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      // Or send the note to the browser
      res.send(note);
    }
  });
}
});
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
// Use the note id to find and delete it
Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
// Log any errors
if (err) {
  console.log(err);
  res.send(err);
}
else {
  db.Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
   // Execute the above query
    .exec(function(err) {
      // Log any errors
      if (err) {
        console.log(err);
        res.send(err);
      }
      else {
       
        res.send("Deleted");
      }
    });
}
});
});

//  server
app.listen(port, function() {
  console.log("App running on port " + port + "!");
});