/**
 * jQuery-csv (jQuery Plugin)
 *
 * This document is licensed as free software under the terms of the
 * MIT License: http://www.opensource.org/licenses/mit-license.php
 *
 * Acknowledgements:
 * The original design and influence to implement this library as a jquery
 * plugin is influenced by jquery-json (http://code.google.com/p/jquery-json/).
 * If you're looking to use native JSON.Stringify but want additional backwards
 * compatibility for browsers that don't support it, I highly recommend you
 * check it out.
 *
 * A special thanks goes out to rwk@acm.org for providing a lot of valuable
 * feedback to the project including the core for the new FSM
 * (Finite State Machine) parsers. If you're looking for a stable TSV parser
 * be sure to take a look at jquery-tsv (http://code.google.com/p/jquery-tsv/).

 * For legal purposes I'll include the "NO WARRANTY EXPRESSED OR IMPLIED.
 * USE AT YOUR OWN RISK.". Which, in 'layman's terms' means, by using this
 * library you are accepting responsibility if it breaks your code.
 *
 * Legal jargon aside, I will do my best to provide a useful and stable core
 * that can effectively be built on.
 *
 * Copyrighted 2012 by Evan Plaice.
 */

RegExp.escape = function (s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
};

(function () {
    'use strict';

    var $;

    // to keep backwards compatibility
    if (typeof jQuery !== 'undefined' && jQuery) {
        $ = jQuery;
    } else {
        $ = {};
    }

    /**
     * jQuery.csv.defaults
     * Encapsulates the method paramater defaults for the CSV plugin module.
     */

    $.csv = {
        defaults: {
            separator: ',',
            delimiter: '"',
            headers: true
        },

        hooks: {
            castToScalar: function (value, state) {
                var hasDot = /\./;
                if (isNaN(value)) {
                    return value;
                } else {
                    if (hasDot.test(value)) {
                        return parseFloat(value);
                    } else {
                        var integer = parseInt(value);
                        if (isNaN(integer)) {
                            return null;
                        } else {
                            return integer;
                        }
                    }
                }
            }
        },

        parsers: {
            parse: function (csv, options) {
                // cache settings
                var separator = options.separator;
                var delimiter = options.delimiter;

                // set initial state if it's missing
                if (!options.state.rowNum) {
                    options.state.rowNum = 1;
                }
                if (!options.state.colNum) {
                    options.state.colNum = 1;
                }

                // clear initial state
                var data = [];
                var entry = [];
                var state = 0;
                var value = '';
                var exit = false;

                function endOfEntry() {
                    // reset the state
                    state = 0;
                    value = '';

                    // if 'start' hasn't been met, don't output
                    if (options.start && options.state.rowNum < options.start) {
                        // update global state
                        entry = [];
                        options.state.rowNum++;
                        options.state.colNum = 1;
                        return;
                    }

                    if (options.onParseEntry === undefined) {
                        // onParseEntry hook not set
                        data.push(entry);
                    } else {
                        var hookVal = options.onParseEntry(entry, options.state); // onParseEntry Hook
                        // false skips the row, configurable through a hook
                        if (hookVal !== false) {
                            data.push(hookVal);
                        }
                    }
                    // console.log('entry:' + entry);

                    // cleanup
                    entry = [];

                    // if 'end' is met, stop parsing
                    if (options.end && options.state.rowNum >= options.end) {
                        exit = true;
                    }

                    // update global state
                    options.state.rowNum++;
                    options.state.colNum = 1;
                }

                function endOfValue() {
                    if (options.onParseValue === undefined) {
                        // onParseValue hook not set
                        entry.push(value);
                    } else if (options.headers && options.state.rowNum === 1) {
                        // don't onParseValue object headers
                        entry.push(value);
                    } else {
                        var hook = options.onParseValue(value, options.state); // onParseValue Hook
                        // false skips the row, configurable through a hook
                        if (hook !== false) {
                            entry.push(hook);
                        }
                    }
                    // console.log('value:' + value);
                    // reset the state
                    value = '';
                    state = 0;
                    // update global state
                    options.state.colNum++;
                }

                // escape regex-specific control chars
                var escSeparator = RegExp.escape(separator);
                var escDelimiter = RegExp.escape(delimiter);

                // compile the regEx str using the custom delimiter/separator
                var match = /(D|S|\r\n|\n|\r|[^DS\r\n]+)/;
                var matchSrc = match.source;
                matchSrc = matchSrc.replace(/S/g, escSeparator);
                matchSrc = matchSrc.replace(/D/g, escDelimiter);
                match = new RegExp(matchSrc, 'gm');

                // put on your fancy pants...
                // process control chars individually, use look-ahead on non-control chars
                csv.replace(match, function (m0) {
                    if (exit) {
                        return;
                    }
                    switch (state) {
                        // the start of a value
                        case 0:
                            // null last value
                            if (m0 === separator) {
                                value += '';
                                endOfValue();
                                break;
                            }
                            // opening delimiter
                            if (m0 === delimiter) {
                                state = 1;
                                break;
                            }
                            // null last value
                            if (/^(\r\n|\n|\r)$/.test(m0)) {
                                endOfValue();
                                endOfEntry();
                                break;
                            }
                            // un-delimited value
                            value += m0;
                            state = 3;
                            break;

                        // delimited input
                        case 1:
                            // second delimiter? check further
                            if (m0 === delimiter) {
                                state = 2;
                                break;
                            }
                            // delimited data
                            value += m0;
                            state = 1;
                            break;

                        // delimiter found in delimited input
                        case 2:
                            // escaped delimiter?
                            if (m0 === delimiter) {
                                value += m0;
                                state = 1;
                                break;
                            }
                            // null value
                            if (m0 === separator) {
                                endOfValue();
                                break;
                            }
                            // end of entry
                            if (/^(\r\n|\n|\r)$/.test(m0)) {
                                endOfValue();
                                endOfEntry();
                                break;
                            }
                            // broken paser?
                            throw Error('CSVDataError: Illegal State [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');

                        // un-delimited input
                        case 3:
                            // null last value
                            if (m0 === separator) {
                                endOfValue();
                                break;
                            }
                            // end of entry
                            if (/^(\r\n|\n|\r)$/.test(m0)) {
                                endOfValue();
                                endOfEntry();
                                break;
                            }
                            if (m0 === delimiter) {
                                // non-compliant data
                                throw Error('CSVDataError: Illegal Quote [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                            }
                            // broken parser?
                            throw Error('CSVDataError: Illegal Data [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                        default:
                            // shenanigans
                            throw Error('CSVDataError: Unknown State [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                    }
                    // console.log('val:' + m0 + ' state:' + state);
                });

                // submit the last entry
                // ignore null last line
                if (entry.length !== 0) {
                    endOfValue();
                    endOfEntry();
                }

                return data;
            },

            // a csv-specific line splitter
            splitLines: function (csv, options) {
                if (!csv) {
                    return undefined;
                }

                options = options || {};

                // cache settings
                var separator = options.separator || $.csv.defaults.separator;
                var delimiter = options.delimiter || $.csv.defaults.delimiter;

                // set initial state if it's missing
                options.state = options.state || {};
                if (!options.state.rowNum) {
                    options.state.rowNum = 1;
                }

                // clear initial state
                var entries = [];
                var state = 0;
                var entry = '';
                var exit = false;

                function endOfLine() {
                    // reset the state
                    state = 0;

                    // if 'start' hasn't been met, don't output
                    if (options.start && options.state.rowNum < options.start) {
                        // update global state
                        entry = '';
                        options.state.rowNum++;
                        return;
                    }

                    if (options.onParseEntry === undefined) {
                        // onParseEntry hook not set
                        entries.push(entry);
                    } else {
                        var hookVal = options.onParseEntry(entry, options.state); // onParseEntry Hook
                        // false skips the row, configurable through a hook
                        if (hookVal !== false) {
                            entries.push(hookVal);
                        }
                    }

                    // cleanup
                    entry = '';

                    // if 'end' is met, stop parsing
                    if (options.end && options.state.rowNum >= options.end) {
                        exit = true;
                    }

                    // update global state
                    options.state.rowNum++;
                }

                // escape regex-specific control chars
                var escSeparator = RegExp.escape(separator);
                var escDelimiter = RegExp.escape(delimiter);

                // compile the regEx str using the custom delimiter/separator
                var match = /(D|S|\n|\r|[^DS\r\n]+)/;
                var matchSrc = match.source;
                matchSrc = matchSrc.replace(/S/g, escSeparator);
                matchSrc = matchSrc.replace(/D/g, escDelimiter);
                match = new RegExp(matchSrc, 'gm');

                // put on your fancy pants...
                // process control chars individually, use look-ahead on non-control chars
                csv.replace(match, function (m0) {
                    if (exit) {
                        return;
                    }
                    switch (state) {
                        // the start of a value/entry
                        case 0:
                            // null value
                            if (m0 === separator) {
                                entry += m0;
                                state = 0;
                                break;
                            }
                            // opening delimiter
                            if (m0 === delimiter) {
                                entry += m0;
                                state = 1;
                                break;
                            }
                            // end of line
                            if (m0 === '\n') {
                                endOfLine();
                                break;
                            }
                            // phantom carriage return
                            if (/^\r$/.test(m0)) {
                                break;
                            }
                            // un-delimit value
                            entry += m0;
                            state = 3;
                            break;

                        // delimited input
                        case 1:
                            // second delimiter? check further
                            if (m0 === delimiter) {
                                entry += m0;
                                state = 2;
                                break;
                            }
                            // delimited data
                            entry += m0;
                            state = 1;
                            break;

                        // delimiter found in delimited input
                        case 2:
                            // escaped delimiter?
                            var prevChar = entry.substr(entry.length - 1);
                            if (m0 === delimiter && prevChar === delimiter) {
                                entry += m0;
                                state = 1;
                                break;
                            }
                            // end of value
                            if (m0 === separator) {
                                entry += m0;
                                state = 0;
                                break;
                            }
                            // end of line
                            if (m0 === '\n') {
                                endOfLine();
                                break;
                            }
                            // phantom carriage return
                            if (m0 === '\r') {
                                break;
                            }
                            // broken paser?
                            throw Error('CSVDataError: Illegal state [Row:' + options.state.rowNum + ']');

                        // un-delimited input
                        case 3:
                            // null value
                            if (m0 === separator) {
                                entry += m0;
                                state = 0;
                                break;
                            }
                            // end of line
                            if (m0 === '\n') {
                                endOfLine();
                                break;
                            }
                            // phantom carriage return
                            if (m0 === '\r') {
                                break;
                            }
                            // non-compliant data
                            if (m0 === delimiter) {
                                throw Error('CSVDataError: Illegal quote [Row:' + options.state.rowNum + ']');
                            }
                            // broken parser?
                            throw Error('CSVDataError: Illegal state [Row:' + options.state.rowNum + ']');
                        default:
                            // shenanigans
                            throw Error('CSVDataError: Unknown state [Row:' + options.state.rowNum + ']');
                    }
                    // console.log('val:' + m0 + ' state:' + state);
                });

                // submit the last entry
                // ignore null last line
                if (entry !== '') {
                    endOfLine();
                }

                return entries;
            },

            // a csv entry parser
            parseEntry: function (csv, options) {
                // cache settings
                var separator = options.separator;
                var delimiter = options.delimiter;

                // set initial state if it's missing
                if (!options.state.rowNum) {
                    options.state.rowNum = 1;
                }
                if (!options.state.colNum) {
                    options.state.colNum = 1;
                }

                // clear initial state
                var entry = [];
                var state = 0;
                var value = '';

                function endOfValue() {
                    if (options.onParseValue === undefined) {
                        // onParseValue hook not set
                        entry.push(value);
                    } else {
                        var hook = options.onParseValue(value, options.state); // onParseValue Hook
                        // false skips the value, configurable through a hook
                        if (hook !== false) {
                            entry.push(hook);
                        }
                    }
                    // reset the state
                    value = '';
                    state = 0;
                    // update global state
                    options.state.colNum++;
                }

                // checked for a cached regEx first
                if (!options.match) {
                    // escape regex-specific control chars
                    var escSeparator = RegExp.escape(separator);
                    var escDelimiter = RegExp.escape(delimiter);

                    // compile the regEx str using the custom delimiter/separator
                    var match = /(D|S|\n|\r|[^DS\r\n]+)/;
                    var matchSrc = match.source;
                    matchSrc = matchSrc.replace(/S/g, escSeparator);
                    matchSrc = matchSrc.replace(/D/g, escDelimiter);
                    options.match = new RegExp(matchSrc, 'gm');
                }

                // put on your fancy pants...
                // process control chars individually, use look-ahead on non-control chars
                csv.replace(options.match, function (m0) {
                    switch (state) {
                        // the start of a value
                        case 0:
                            // null last value
                            if (m0 === separator) {
                                value += '';
                                endOfValue();
                                break;
                            }
                            // opening delimiter
                            if (m0 === delimiter) {
                                state = 1;
                                break;
                            }
                            // skip un-delimited new-lines
                            if (m0 === '\n' || m0 === '\r') {
                                break;
                            }
                            // un-delimited value
                            value += m0;
                            state = 3;
                            break;

                        // delimited input
                        case 1:
                            // second delimiter? check further
                            if (m0 === delimiter) {
                                state = 2;
                                break;
                            }
                            // delimited data
                            value += m0;
                            state = 1;
                            break;

                        // delimiter found in delimited input
                        case 2:
                            // escaped delimiter?
                            if (m0 === delimiter) {
                                value += m0;
                                state = 1;
                                break;
                            }
                            // null value
                            if (m0 === separator) {
                                endOfValue();
                                break;
                            }
                            // skip un-delimited new-lines
                            if (m0 === '\n' || m0 === '\r') {
                                break;
                            }
                            // broken paser?
                            throw Error('CSVDataError: Illegal State [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');

                        // un-delimited input
                        case 3:
                            // null last value
                            if (m0 === separator) {
                                endOfValue();
                                break;
                            }
                            // skip un-delimited new-lines
                            if (m0 === '\n' || m0 === '\r') {
                                break;
                            }
                            // non-compliant data
                            if (m0 === delimiter) {
                                throw Error('CSVDataError: Illegal Quote [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                            }
                            // broken parser?
                            throw Error('CSVDataError: Illegal Data [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                        default:
                            // shenanigans
                            throw Error('CSVDataError: Unknown State [Row:' + options.state.rowNum + '][Col:' + options.state.colNum + ']');
                    }
                    // console.log('val:' + m0 + ' state:' + state);
                });

                // submit the last value
                endOfValue();

                return entry;
            }
        },

        helpers: {

            /**
             * $.csv.helpers.collectPropertyNames(objectsArray)
             * Collects all unique property names from all passed objects.
             *
             * @param {Array} objects Objects to collect properties from.
             *
             * Returns an array of property names (array will be empty,
             * if objects have no own properties).
             */
            collectPropertyNames: function (objects) {
                var o = [];
                var propName = [];
                var props = [];
                for (o in objects) {
                    for (propName in objects[o]) {
                        if ((objects[o].hasOwnProperty(propName)) &&
                            (props.indexOf(propName) < 0) &&
                            (typeof objects[o][propName] !== 'function')) {
                            props.push(propName);
                        }
                    }
                }
                return props;
            }
        },

        /**
         * $.csv.toArray(csv)
         * Converts a CSV entry string to a javascript array.
         *
         * @param {Array} csv The string containing the CSV data.
         * @param {Object} [options] An object containing user-defined options.
         * @param {Character} [separator] An override for the separator character. Defaults to a comma(,).
         * @param {Character} [delimiter] An override for the delimiter character. Defaults to a double-quote(").
         *
         * This method deals with simple CSV strings only. It's useful if you only
         * need to parse a single entry. If you need to parse more than one line,
         * use $.csv2Array instead.
         */
        toArray: function (csv, options, callback) {
            // if callback was passed to options swap callback with options
            if (options !== undefined && typeof (options) === 'function') {
                if (callback !== undefined) {
                    return console.error('You cannot 3 arguments with the 2nd argument being a function');
                }
                callback = options;
                options = {};
            }

            options = (options !== undefined ? options : {});
            var config = {};
            config.callback = ((callback !== undefined && typeof (callback) === 'function') ? callback : false);
            config.separator = 'separator' in options ? options.separator : $.csv.defaults.separator;
            config.delimiter = 'delimiter' in options ? options.delimiter : $.csv.defaults.delimiter;
            var state = (options.state !== undefined ? options.state : {});

            // setup
            options = {
                delimiter: config.delimiter,
                separator: config.separator,
                onParseEntry: options.onParseEntry,
                onParseValue: options.onParseValue,
                state: state
            };

            var entry = $.csv.parsers.parseEntry(csv, options);

            // push the value to a callback if one is defined
            if (!config.callback) {
                return entry;
            } else {
                config.callback('', entry);
            }
        },

        /**
         * $.csv.toArrays(csv)
         * Converts a CSV string to a javascript array.
         *
         * @param {String} csv The string containing the raw CSV data.
         * @param {Object} [options] An object containing user-defined options.
         * @param {Character} [separator] An override for the separator character. Defaults to a comma(,).
         * @param {Character} [delimiter] An override for the delimiter character. Defaults to a double-quote(").
         *
         * This method deals with multi-line CSV. The breakdown is simple. The first
         * dimension of the array represents the line (or entry/row) while the second
         * dimension contains the values (or values/columns).
         */
        toArrays: function (csv, options, callback) {
            // if callback was passed to options swap callback with options
            if (options !== undefined && typeof (options) === 'function') {
                if (callback !== undefined) {
                    return console.error('You cannot 3 arguments with the 2nd argument being a function');
                }
                callback = options;
                options = {};
            }

            options = (options !== undefined ? options : {});
            var config = {};
            config.callback = ((callback !== undefined && typeof (callback) === 'function') ? callback : false);
            config.separator = 'separator' in options ? options.separator : $.csv.defaults.separator;
            config.delimiter = 'delimiter' in options ? options.delimiter : $.csv.defaults.delimiter;

            // setup
            var data = [];
            options = {
                delimiter: config.delimiter,
                separator: config.separator,
                onPreParse: options.onPreParse,
                onParseEntry: options.onParseEntry,
                onParseValue: options.onParseValue,
                onPostParse: options.onPostParse,
                start: options.start,
                end: options.end,
                state: {
                    rowNum: 1,
                    colNum: 1
                }
            };

            // onPreParse hook
            if (options.onPreParse !== undefined) {
                csv = options.onPreParse(csv, options.state);
            }

            // parse the data
            data = $.csv.parsers.parse(csv, options);

            // onPostParse hook
            if (options.onPostParse !== undefined) {
                data = options.onPostParse(data, options.state);
            }

            // push the value to a callback if one is defined
            if (!config.callback) {
                return data;
            } else {
                config.callback('', data);
            }
        },

        /**
         * $.csv.toObjects(csv)
         * Converts a CSV string to a javascript object.
         * @param {String} csv The string containing the raw CSV data.
         * @param {Object} [options] An object containing user-defined options.
         * @param {Character} [separator] An override for the separator character. Defaults to a comma(,).
         * @param {Character} [delimiter] An override for the delimiter character. Defaults to a double-quote(").
         * @param {Boolean} [headers] Indicates whether the data contains a header line. Defaults to true.
         *
         * This method deals with multi-line CSV strings. Where the headers line is
         * used as the key for each value per entry.
         */
        toObjects: function (csv, options, callback) {
            // if callback was passed to options swap callback with options
            if (options !== undefined && typeof (options) === 'function') {
                if (callback !== undefined) {
                    return console.error('You cannot 3 arguments with the 2nd argument being a function');
                }
                callback = options;
                options = {};
            }

            options = (options !== undefined ? options : {});
            var config = {};
            config.callback = ((callback !== undefined && typeof (callback) === 'function') ? callback : false);
            config.separator = 'separator' in options ? options.separator : $.csv.defaults.separator;
            config.delimiter = 'delimiter' in options ? options.delimiter : $.csv.defaults.delimiter;
            config.headers = 'headers' in options ? options.headers : $.csv.defaults.headers;
            options.start = 'start' in options ? options.start : 1;

            // account for headers
            if (config.headers) {
                options.start++;
            }
            if (options.end && config.headers) {
                options.end++;
            }

            // setup
            var lines = [];
            var data = [];

            options = {
                delimiter: config.delimiter,
                separator: config.separator,
                onPreParse: options.onPreParse,
                onParseEntry: options.onParseEntry,
                onParseValue: options.onParseValue,
                onPostParse: options.onPostParse,
                start: options.start,
                end: options.end,
                state: {
                    rowNum: 1,
                    colNum: 1
                },
                match: false,
                transform: options.transform
            };

            // fetch the headers
            var headerOptions = {
                delimiter: config.delimiter,
                separator: config.separator,
                start: 1,
                end: 1,
                state: {
                    rowNum: 1,
                    colNum: 1
                },
                headers: true
            };

            // onPreParse hook
            if (options.onPreParse !== undefined) {
                csv = options.onPreParse(csv, options.state);
            }

            // parse the csv
            var headerLine = $.csv.parsers.splitLines(csv, headerOptions);
            var headers = $.csv.toArray(headerLine[0], headerOptions);

            // fetch the data
            lines = $.csv.parsers.splitLines(csv, options);

            // reset the state for re-use
            options.state.colNum = 1;
            if (headers) {
                options.state.rowNum = 2;
            } else {
                options.state.rowNum = 1;
            }

            // convert data to objects
            for (var i = 0, len = lines.length; i < len; i++) {
                var entry = $.csv.toArray(lines[i], options);
                var object = {};
                for (var j = 0; j < headers.length; j++) {
                    object[headers[j]] = entry[j];
                }
                if (options.transform !== undefined) {
                    data.push(options.transform.call(undefined, object));
                } else {
                    data.push(object);
                }

                // update row state
                options.state.rowNum++;
            }

            // onPostParse hook
            if (options.onPostParse !== undefined) {
                data = options.onPostParse(data, options.state);
            }

            // push the value to a callback if one is defined
            if (!config.callback) {
                return data;
            } else {
                config.callback('', data);
            }
        },

        /**
        * $.csv.fromArrays(arrays)
        * Converts a javascript array to a CSV String.
        *
        * @param {Array} arrays An array containing an array of CSV entries.
        * @param {Object} [options] An object containing user-defined options.
        * @param {Character} [separator] An override for the separator character. Defaults to a comma(,).
        * @param {Character} [delimiter] An override for the delimiter character. Defaults to a double-quote(").
        *
        * This method generates a CSV file from an array of arrays (representing entries).
        */
        fromArrays: function (arrays, options, callback) {
            // if callback was passed to options swap callback with options
            if (options !== undefined && typeof (options) === 'function') {
                if (callback !== undefined) {
                    return console.error('You cannot 3 arguments with the 2nd argument being a function');
                }
                callback = options;
                options = {};
            }

            options = (options !== undefined ? options : {});
            var config = {};
            config.callback = ((callback !== undefined && typeof (callback) === 'function') ? callback : false);
            config.separator = 'separator' in options ? options.separator : $.csv.defaults.separator;
            config.delimiter = 'delimiter' in options ? options.delimiter : $.csv.defaults.delimiter;

            var output = '';
            var line;
            var lineValues;
            var i;
            var j;

            for (i = 0; i < arrays.length; i++) {
                line = arrays[i];
                lineValues = [];
                for (j = 0; j < line.length; j++) {
                    var strValue = (line[j] === undefined || line[j] === null) ? '' : line[j].toString();
                    if (strValue.indexOf(config.delimiter) > -1) {
                        strValue = strValue.replace(new RegExp(config.delimiter, 'g'), config.delimiter + config.delimiter);
                    }

                    var escMatcher = '\n|\r|S|D';
                    escMatcher = escMatcher.replace('S', config.separator);
                    escMatcher = escMatcher.replace('D', config.delimiter);

                    if (strValue.search(escMatcher) > -1) {
                        strValue = config.delimiter + strValue + config.delimiter;
                    }
                    lineValues.push(strValue);
                }
                output += lineValues.join(config.separator) + '\n';
            }

            // push the value to a callback if one is defined
            if (!config.callback) {
                return output;
            } else {
                config.callback('', output);
            }
        },

        /**
         * $.csv.fromObjects(objects)
         * Converts a javascript dictionary to a CSV string.
         *
         * @param {Object} objects An array of objects containing the data.
         * @param {Object} [options] An object containing user-defined options.
         * @param {Character} [separator] An override for the separator character. Defaults to a comma(,).
         * @param {Character} [delimiter] An override for the delimiter character. Defaults to a double-quote(").
         * @param {Character} [sortOrder] Sort order of columns (named after
         *   object properties). Use 'alpha' for alphabetic. Default is 'declare',
         *   which means, that properties will _probably_ appear in order they were
         *   declared for the object. But without any guarantee.
         * @param {Character or Array} [manualOrder] Manually order columns. May be
         * a strin in a same csv format as an output or an array of header names
         * (array items won't be parsed). All the properties, not present in
         * `manualOrder` will be appended to the end in accordance with `sortOrder`
         * option. So the `manualOrder` always takes preference, if present.
         *
         * This method generates a CSV file from an array of objects (name:value pairs).
         * It starts by detecting the headers and adding them as the first line of
         * the CSV file, followed by a structured dump of the data.
         */
        fromObjects: function (objects, options, callback) {
            // if callback was passed to options swap callback with options
            if (options !== undefined && typeof (options) === 'function') {
                if (callback !== undefined) {
                    return console.error('You cannot 3 arguments with the 2nd argument being a function');
                }
                callback = options;
                options = {};
            }

            options = (options !== undefined ? options : {});
            var config = {};
            config.callback = ((callback !== undefined && typeof (callback) === 'function') ? callback : false);
            config.separator = 'separator' in options ? options.separator : $.csv.defaults.separator;
            config.delimiter = 'delimiter' in options ? options.delimiter : $.csv.defaults.delimiter;
            config.headers = 'headers' in options ? options.headers : $.csv.defaults.headers;
            config.sortOrder = 'sortOrder' in options ? options.sortOrder : 'declare';
            config.manualOrder = 'manualOrder' in options ? options.manualOrder : [];
            config.transform = options.transform;

            if (typeof config.manualOrder === 'string') {
                config.manualOrder = $.csv.toArray(config.manualOrder, config);
            }

            if (config.transform !== undefined) {
                var origObjects = objects;
                objects = [];

                var i;
                for (i = 0; i < origObjects.length; i++) {
                    objects.push(config.transform.call(undefined, origObjects[i]));
                }
            }

            var props = $.csv.helpers.collectPropertyNames(objects);

            if (config.sortOrder === 'alpha') {
                props.sort();
            } // else {} - nothing to do for 'declare' order

            if (config.manualOrder.length > 0) {
                var propsManual = [].concat(config.manualOrder);
                var p;
                for (p = 0; p < props.length; p++) {
                    if (propsManual.indexOf(props[p]) < 0) {
                        propsManual.push(props[p]);
                    }
                }
                props = propsManual;
            }

            var o;
            var line;
            var output = [];
            var propName;
            if (config.headers) {
                output.push(props);
            }

            for (o = 0; o < objects.length; o++) {
                line = [];
                for (p = 0; p < props.length; p++) {
                    propName = props[p];
                    if (propName in objects[o] && typeof objects[o][propName] !== 'function') {
                        line.push(objects[o][propName]);
                    } else {
                        line.push('');
                    }
                }
                output.push(line);
            }

            // push the value to a callback if one is defined
            return $.csv.fromArrays(output, options, config.callback);
        }
    };

    // Maintenance code to maintain backward-compatibility
    // Will be removed in release 1.0
    $.csvEntry2Array = $.csv.toArray;
    $.csv2Array = $.csv.toArrays;
    $.csv2Dictionary = $.csv.toObjects;

    // CommonJS module is defined
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = $.csv;
    }
}).call(this);



/*!
 * is.js 0.9.0
 * Author: Aras Atasaygin
 */
(function (n, t) { if (typeof define === "function" && define.amd) { define(function () { return n.is = t() }) } else if (typeof exports === "object") { module.exports = t() } else { n.is = t() } })(this, function () { var n = {}; n.VERSION = "0.8.0"; n.not = {}; n.all = {}; n.any = {}; var t = Object.prototype.toString; var e = Array.prototype.slice; var r = Object.prototype.hasOwnProperty; function a(n) { return function () { return !n.apply(null, e.call(arguments)) } } function u(n) { return function () { var t = c(arguments); var e = t.length; for (var r = 0; r < e; r++) { if (!n.call(null, t[r])) { return false } } return true } } function o(n) { return function () { var t = c(arguments); var e = t.length; for (var r = 0; r < e; r++) { if (n.call(null, t[r])) { return true } } return false } } var i = { "<": function (n, t) { return n < t }, "<=": function (n, t) { return n <= t }, ">": function (n, t) { return n > t }, ">=": function (n, t) { return n >= t } }; function f(n, t) { var e = t + ""; var r = +(e.match(/\d+/) || NaN); var a = e.match(/^[<>]=?|/)[0]; return i[a] ? i[a](n, r) : n == r || r !== r } function c(t) { var r = e.call(t); var a = r.length; if (a === 1 && n.array(r[0])) { r = r[0] } return r } n.arguments = function (n) { return t.call(n) === "[object Arguments]" || n != null && typeof n === "object" && "callee" in n }; n.array = Array.isArray || function (n) { return t.call(n) === "[object Array]" }; n.boolean = function (n) { return n === true || n === false || t.call(n) === "[object Boolean]" }; n.char = function (t) { return n.string(t) && t.length === 1 }; n.date = function (n) { return t.call(n) === "[object Date]" }; n.domNode = function (t) { return n.object(t) && t.nodeType > 0 }; n.error = function (n) { return t.call(n) === "[object Error]" }; n["function"] = function (n) { return t.call(n) === "[object Function]" || typeof n === "function" }; n.json = function (n) { return t.call(n) === "[object Object]" }; n.nan = function (n) { return n !== n }; n["null"] = function (n) { return n === null }; n.number = function (e) { return n.not.nan(e) && t.call(e) === "[object Number]" }; n.object = function (n) { return Object(n) === n }; n.regexp = function (n) { return t.call(n) === "[object RegExp]" }; n.sameType = function (e, r) { var a = t.call(e); if (a !== t.call(r)) { return false } if (a === "[object Number]") { return !n.any.nan(e, r) || n.all.nan(e, r) } return true }; n.sameType.api = ["not"]; n.string = function (n) { return t.call(n) === "[object String]" }; n.undefined = function (n) { return n === void 0 }; n.windowObject = function (n) { return n != null && typeof n === "object" && "setInterval" in n }; n.empty = function (t) { if (n.object(t)) { var e = Object.getOwnPropertyNames(t).length; if (e === 0 || e === 1 && n.array(t) || e === 2 && n.arguments(t)) { return true } return false } return t === "" }; n.existy = function (n) { return n != null }; n.falsy = function (n) { return !n }; n.truthy = a(n.falsy); n.above = function (t, e) { return n.all.number(t, e) && t > e }; n.above.api = ["not"]; n.decimal = function (t) { return n.number(t) && t % 1 !== 0 }; n.equal = function (t, e) { if (n.all.number(t, e)) { return t === e && 1 / t === 1 / e } if (n.all.string(t, e) || n.all.regexp(t, e)) { return "" + t === "" + e } if (n.all.boolean(t, e)) { return t === e } return false }; n.equal.api = ["not"]; n.even = function (t) { return n.number(t) && t % 2 === 0 }; n.finite = isFinite || function (t) { return n.not.infinite(t) && n.not.nan(t) }; n.infinite = function (n) { return n === Infinity || n === -Infinity }; n.integer = function (t) { return n.number(t) && t % 1 === 0 }; n.negative = function (t) { return n.number(t) && t < 0 }; n.odd = function (t) { return n.number(t) && t % 2 === 1 }; n.positive = function (t) { return n.number(t) && t > 0 }; n.under = function (t, e) { return n.all.number(t, e) && t < e }; n.under.api = ["not"]; n.within = function (t, e, r) { return n.all.number(t, e, r) && t > e && t < r }; n.within.api = ["not"]; var l = { affirmative: /^(?:1|t(?:rue)?|y(?:es)?|ok(?:ay)?)$/, alphaNumeric: /^[A-Za-z0-9]+$/, caPostalCode: /^(?!.*[DFIOQU])[A-VXY][0-9][A-Z]\s?[0-9][A-Z][0-9]$/, creditCard: /^(?:(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11}))$/, dateString: /^(1[0-2]|0?[1-9])([\/-])(3[01]|[12][0-9]|0?[1-9])(?:\2)(?:[0-9]{2})?[0-9]{2}$/, email: /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i, eppPhone: /^\+[0-9]{1,3}\.[0-9]{4,14}(?:x.+)?$/, hexadecimal: /^(?:0x)?[0-9a-fA-F]+$/, hexColor: /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, ipv4: /^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/, ipv6: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i, nanpPhone: /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, socialSecurityNumber: /^(?!000|666)[0-8][0-9]{2}-?(?!00)[0-9]{2}-?(?!0000)[0-9]{4}$/, timeString: /^(2[0-3]|[01]?[0-9]):([0-5]?[0-9]):([0-5]?[0-9])$/, ukPostCode: /^[A-Z]{1,2}[0-9RCHNQ][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2}$|^[A-Z]{2}-?[0-9]{4}$/, url: /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/i, usZipCode: /^[0-9]{5}(?:-[0-9]{4})?$/ }; function d(t, e) { n[t] = function (n) { return e[t].test(n) } } for (var s in l) { if (l.hasOwnProperty(s)) { d(s, l) } } n.ip = function (t) { return n.ipv4(t) || n.ipv6(t) }; n.capitalized = function (t) { if (n.not.string(t)) { return false } var e = t.split(" "); for (var r = 0; r < e.length; r++) { var a = e[r]; if (a.length) { var u = a.charAt(0); if (u !== u.toUpperCase()) { return false } } } return true }; n.endWith = function (t, e) { if (n.not.string(t)) { return false } e += ""; var r = t.length - e.length; return r >= 0 && t.indexOf(e, r) === r }; n.endWith.api = ["not"]; n.include = function (n, t) { return n.indexOf(t) > -1 }; n.include.api = ["not"]; n.lowerCase = function (t) { return n.string(t) && t === t.toLowerCase() }; n.palindrome = function (t) { if (n.not.string(t)) { return false } t = t.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase(); var e = t.length - 1; for (var r = 0, a = Math.floor(e / 2); r <= a; r++) { if (t.charAt(r) !== t.charAt(e - r)) { return false } } return true }; n.space = function (t) { if (n.not.char(t)) { return false } var e = t.charCodeAt(0); return e > 8 && e < 14 || e === 32 }; n.startWith = function (t, e) { return n.string(t) && t.indexOf(e) === 0 }; n.startWith.api = ["not"]; n.upperCase = function (t) { return n.string(t) && t === t.toUpperCase() }; var F = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]; var p = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]; n.day = function (t, e) { return n.date(t) && e.toLowerCase() === F[t.getDay()] }; n.day.api = ["not"]; n.dayLightSavingTime = function (n) { var t = new Date(n.getFullYear(), 0, 1); var e = new Date(n.getFullYear(), 6, 1); var r = Math.max(t.getTimezoneOffset(), e.getTimezoneOffset()); return n.getTimezoneOffset() < r }; n.future = function (t) { var e = new Date; return n.date(t) && t.getTime() > e.getTime() }; n.inDateRange = function (t, e, r) { if (n.not.date(t) || n.not.date(e) || n.not.date(r)) { return false } var a = t.getTime(); return a > e.getTime() && a < r.getTime() }; n.inDateRange.api = ["not"]; n.inLastMonth = function (t) { return n.inDateRange(t, new Date((new Date).setMonth((new Date).getMonth() - 1)), new Date) }; n.inLastWeek = function (t) { return n.inDateRange(t, new Date((new Date).setDate((new Date).getDate() - 7)), new Date) }; n.inLastYear = function (t) { return n.inDateRange(t, new Date((new Date).setFullYear((new Date).getFullYear() - 1)), new Date) }; n.inNextMonth = function (t) { return n.inDateRange(t, new Date, new Date((new Date).setMonth((new Date).getMonth() + 1))) }; n.inNextWeek = function (t) { return n.inDateRange(t, new Date, new Date((new Date).setDate((new Date).getDate() + 7))) }; n.inNextYear = function (t) { return n.inDateRange(t, new Date, new Date((new Date).setFullYear((new Date).getFullYear() + 1))) }; n.leapYear = function (t) { return n.number(t) && (t % 4 === 0 && t % 100 !== 0 || t % 400 === 0) }; n.month = function (t, e) { return n.date(t) && e.toLowerCase() === p[t.getMonth()] }; n.month.api = ["not"]; n.past = function (t) { var e = new Date; return n.date(t) && t.getTime() < e.getTime() }; n.quarterOfYear = function (t, e) { return n.date(t) && n.number(e) && e === Math.floor((t.getMonth() + 3) / 3) }; n.quarterOfYear.api = ["not"]; n.today = function (t) { var e = new Date; var r = e.toDateString(); return n.date(t) && t.toDateString() === r }; n.tomorrow = function (t) { var e = new Date; var r = new Date(e.setDate(e.getDate() + 1)).toDateString(); return n.date(t) && t.toDateString() === r }; n.weekend = function (t) { return n.date(t) && (t.getDay() === 6 || t.getDay() === 0) }; n.weekday = a(n.weekend); n.year = function (t, e) { return n.date(t) && n.number(e) && e === t.getFullYear() }; n.year.api = ["not"]; n.yesterday = function (t) { var e = new Date; var r = new Date(e.setDate(e.getDate() - 1)).toDateString(); return n.date(t) && t.toDateString() === r }; var D = n.windowObject(typeof global == "object" && global) && global; var h = n.windowObject(typeof self == "object" && self) && self; var v = n.windowObject(typeof this == "object" && this) && this; var b = D || h || v || Function("return this")(); var g = h && h.document; var m = b.is; var w = h && h.navigator; var y = (w && w.appVersion || "").toLowerCase(); var x = (w && w.userAgent || "").toLowerCase(); var A = (w && w.vendor || "").toLowerCase(); n.android = function () { return /android/.test(x) }; n.android.api = ["not"]; n.androidPhone = function () { return /android/.test(x) && /mobile/.test(x) }; n.androidPhone.api = ["not"]; n.androidTablet = function () { return /android/.test(x) && !/mobile/.test(x) }; n.androidTablet.api = ["not"]; n.blackberry = function () { return /blackberry/.test(x) || /bb10/.test(x) }; n.blackberry.api = ["not"]; n.chrome = function (n) { var t = /google inc/.test(A) ? x.match(/(?:chrome|crios)\/(\d+)/) : null; return t !== null && f(t[1], n) }; n.chrome.api = ["not"]; n.desktop = function () { return n.not.mobile() && n.not.tablet() }; n.desktop.api = ["not"]; n.edge = function (n) { var t = x.match(/edge\/(\d+)/); return t !== null && f(t[1], n) }; n.edge.api = ["not"]; n.firefox = function (n) { var t = x.match(/(?:firefox|fxios)\/(\d+)/); return t !== null && f(t[1], n) }; n.firefox.api = ["not"]; n.ie = function (n) { var t = x.match(/(?:msie |trident.+?; rv:)(\d+)/); return t !== null && f(t[1], n) }; n.ie.api = ["not"]; n.ios = function () { return n.iphone() || n.ipad() || n.ipod() }; n.ios.api = ["not"]; n.ipad = function (n) { var t = x.match(/ipad.+?os (\d+)/); return t !== null && f(t[1], n) }; n.ipad.api = ["not"]; n.iphone = function (n) { var t = x.match(/iphone(?:.+?os (\d+))?/); return t !== null && f(t[1] || 1, n) }; n.iphone.api = ["not"]; n.ipod = function (n) { var t = x.match(/ipod.+?os (\d+)/); return t !== null && f(t[1], n) }; n.ipod.api = ["not"]; n.linux = function () { return /linux/.test(y) }; n.linux.api = ["not"]; n.mac = function () { return /mac/.test(y) }; n.mac.api = ["not"]; n.mobile = function () { return n.iphone() || n.ipod() || n.androidPhone() || n.blackberry() || n.windowsPhone() }; n.mobile.api = ["not"]; n.offline = a(n.online); n.offline.api = ["not"]; n.online = function () { return !w || w.onLine === true }; n.online.api = ["not"]; n.opera = function (n) { var t = x.match(/(?:^opera.+?version|opr)\/(\d+)/); return t !== null && f(t[1], n) }; n.opera.api = ["not"]; n.phantom = function (n) { var t = x.match(/phantomjs\/(\d+)/); return t !== null && f(t[1], n) }; n.phantom.api = ["not"]; n.safari = function (n) { var t = x.match(/version\/(\d+).+?safari/); return t !== null && f(t[1], n) }; n.safari.api = ["not"]; n.tablet = function () { return n.ipad() || n.androidTablet() || n.windowsTablet() }; n.tablet.api = ["not"]; n.touchDevice = function () { return !!g && ("ontouchstart" in h || "DocumentTouch" in h && g instanceof DocumentTouch) }; n.touchDevice.api = ["not"]; n.windows = function () { return /win/.test(y) }; n.windows.api = ["not"]; n.windowsPhone = function () { return n.windows() && /phone/.test(x) }; n.windowsPhone.api = ["not"]; n.windowsTablet = function () { return n.windows() && n.not.windowsPhone() && /touch/.test(x) }; n.windowsTablet.api = ["not"]; n.propertyCount = function (t, e) { if (n.not.object(t) || n.not.number(e)) { return false } var a = 0; for (var u in t) { if (r.call(t, u) && ++a > e) { return false } } return a === e }; n.propertyCount.api = ["not"]; n.propertyDefined = function (t, e) { return n.object(t) && n.string(e) && e in t }; n.propertyDefined.api = ["not"]; n.inArray = function (t, e) { if (n.not.array(e)) { return false } for (var r = 0; r < e.length; r++) { if (e[r] === t) { return true } } return false }; n.inArray.api = ["not"]; n.sorted = function (t, e) { if (n.not.array(t)) { return false } var r = i[e] || i[">="]; for (var a = 1; a < t.length; a++) { if (!r(t[a], t[a - 1])) { return false } } return true }; function j() { var t = n; for (var e in t) { if (r.call(t, e) && n["function"](t[e])) { var i = t[e].api || ["not", "all", "any"]; for (var f = 0; f < i.length; f++) { if (i[f] === "not") { n.not[e] = a(n[e]) } if (i[f] === "all") { n.all[e] = u(n[e]) } if (i[f] === "any") { n.any[e] = o(n[e]) } } } } } j(); n.setNamespace = function () { b.is = m; return this }; n.setRegexp = function (n, t) { for (var e in l) { if (r.call(l, e) && t === e) { l[e] = n } } }; return n });