var sqlite3 = require('sqlite3').verbose();
var md5 = require('md5');

const DBSOURCE = "./db.sqlite";

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run('CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, botid text, author text, note text, notetime text)',
            (err) => {
                if (err) {
                    // Table already created
                } else {
                    // Table just created, creating some rows
                    var insert = 'INSERT INTO notes (botid, author, note, notetime) VALUES (?,?,?, ?)';
                    db.run(insert, ["EZBAR101", "Joe", "This is a note", "2020-3-1 11:00:00"]);
                    db.run(insert, ["EZBAR7003", "Nancy", "Some other note", "2020-3-1 10:00:00"]);
                    db.run(insert, ["EZBAR7003", "John", "Johnny note", "2020-3-1 8:07:16"]);
                }
            });
    }
});


module.exports = db;