/* Load Modules */
const express = require('express');
const router = express.Router();
const Cache = require("cache");


c = new Cache(18 * 1000);    // Create a cache with 18 second TTL

//test api to get all currently cached
router.get('/', function (req, res) {
    c.put("key1", "Value1");
    c.put("key2", "Value1");
    res.json({
        "message": "success",
        "haveControl": false,
        "currentController": "",
        "data": c.data,
        "key1": c.get("key1")
    });
});

// try to reserve a bot
router.post('/', function (req, res) {
    var key = req.body.botid;
    var val = req.body.author;
    console.log(key, val);

    var cur = c.get(key);
    if (cur && cur.length > 0 && cur !== val) {
        // Someone else is using this item
        res.json({
            "message": "success",
            "haveControl": false,
            "currentController": cur
        });
    } else {
        // Take control
        c.put(key, val);      // put it in the cache.
        res.json({
            "message": "success",
            "haveControl": true,
            "currentController": val
        });
    }

});


module.exports = router;
