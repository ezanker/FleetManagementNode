/* Load Modules */
const express = require('express');
const router = express.Router();

var db = require("../../../database.js");

/**
 * Notes Entity routes
 */

//get all notes
router.get('/', function (req, res) {
    var sql = "select * from notes";
    var params = [];
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

//get all notes for specific BAR
router.get('/:id', function (req, res) {
    console.log("BOTID: ", req.params.id);
    var sql = "select * from notes where botid = ?";
    var params = [req.params.id];
    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows,
            "count": rows.length
        });
    });
});


//create a new note
router.post('/', function (req, res) {
    var sql = 'INSERT INTO notes (botid, author, note, notetime) VALUES (?,?,?,?)';
    var params = [req.body.botid, req.body.author, req.body.note, req.body.notetime ];
    console.log(params);

    db.run(sql, params, function (err, result) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        } else {
            var sqlG = "select * from notes where botid = ?";
            var paramsG = [req.body.botid];
            db.all(sqlG, paramsG, (err, rows) => {
                if (err) {
                    res.status(400).json({ "error": err.message });
                    return;
                }
                res.json({
                    "message": "success",
                    "data": rows
                });
            });

        }
    });

});

//in case we allow deleting a note
router.delete('/:id', function (req, res) {
    res.json({
        message: "Passed note deleted (not implemented)"
    });
});

//in case we allow changing existing notes
router.put('/:id', function (req, res) {
    res.json({
        message: "passed note updated (not implemented)"
    });
});

module.exports = router;