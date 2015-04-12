// http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/
var stream = require('stream');
var utils = require('util');
var yaml = require('js-yaml');

function linereader() {
	(stream.Transform).call(this, {
		objectMode: true
	});
}

utils.inherits(linereader, stream.Transform);

linereader.prototype._transform = function(chunk, encoding, done) {
	var data = chunk.toString();
	if (this._lastLineData) data = this._lastLineData + data;

	var lines = data.split('\n');
	this._lastLineData = lines.splice(lines.length - 1, 1)[0];

	lines.forEach(this.push.bind(this));
	done();
};

linereader.prototype._flush = function(done) {
	if (this._lastLineData) this.push(this._lastLineData);
	this._lastLineData = null;
	done();
};

module.exports = linereader;

var clone = function(obj) {
	return obj; //JSON.parse(JSON.stringify(obj));
};

var unwind = function(data, _root, _propName) {
	var root = _root ? _root : {};
	var objList = [root];
	var propName = _propName;
	var i, k, len, resLen, props;
	var newItems = [];
	if (data && Array.isArray(data)) {
		len = data.length;
		resLen = objList.length;
		i = -1;
		var rootClone = clone(root);
		while (++i < len) {
			newItems.push.apply(newItems, unwind(data[i], clone(rootClone), propName));
		}
	} else if (data && 'object' === typeof(data)) {
		props = Object.keys(data);
		len = props.length;
		k = 0;
		for (i = 0; i < len; i++) {
			// newItems = clone(objList);
			resLen = objList.length;
			k = 0;
			while (k++ < resLen) {
				var buf = objList.shift();
				var res = unwind(data[props[i]], buf, (propName ? propName + '<-' : '') + props[i]);
				newItems.push.apply(newItems, res.length > 0 ? res : [buf]);
			}
			objList = newItems;
		}
	} else {
		// if (data !== '' && data !== undefined && data !== null)
		root[propName] = data;
		return [root];
	}
	return newItems;
};

var fs = require('fs-extra');
var path = require('path');

var list = fs.readdirSync('gloss');
list = list.filter(function(fl) {
	return (path.extname(fl) === '.md' && fl.length == 4);
}).map(function(f) {
	return {
		file: path.join('gloss', f),
		name: f.slice(0, 1)
	};
});

// var list = [{
// 	file: 'gloss/а.md',
// 	name: 'gloss'
// }];

var gloss = [{
	file: 'gloss/gloss.md',
	name: 'gloss'
}];

var pipe = require('pipeline.js');

var extractor = require('./extractor.js').extractor;
var Deque = require("double-ended-queue");
var _ = require('lodash');

var runner = new pipe.Pipeline([
	function(ctx) {
		ctx.aplha = yaml.load(fs.readFileSync('./AIUBG.yaml'));
	},
	function(ctx) {
		var Factory = require('fte.js').Factory;
		var f = new Factory({
			root: ['./']
		});
		for (var gItem in ctx.aplha) {
			var item = ctx.aplha[gItem];
			if (gItem == 'gloss') {

			} else {
				var src = f.run({
					name: gItem,
					content: item
				}, 'alphacontent.nhtml');

				fs.writeFileSync('alphabet/' + gItem + '.md', src);
			}

		}
	}
]);


runner.execute({}, function(err, ctx) {
	if (!err) {} else {
		console.log(err.stack);
	}
});