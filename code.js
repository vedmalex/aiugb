// http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/
var stream = require('stream');
var utils = require('util');

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

var fs = require('fs-extra');
var path = require('path');

var list = fs.readdirSync('./');
list = list.filter(function(fl) {
	return (path.extname(fl) === '.md' && fl.length == 4);
}).map(function(f) {
	return {
		file: f,
		name: f.slice(0, 1)
	};
});

// var list = [{
// 	file: 'а.md',
// 	name: 'а'
// }];
var pipe = require('pipeline.js');

var processFile = new pipe.Parallel({
	split: function(ctx) {
		return ctx.list.map(function(i) {
			var res = ctx.fork(i);
			res.index = res.bg[i.name] = [];
			return res;
		});
	},
	stage: function(ctx, done) {
		var source = fs.createReadStream(ctx.file);
		var liner = new linereader();
		source.pipe(liner);
		var number = 0;
		var ln = 0;
		var hasError;
		var line;
		var current;
		var current1;
		var current2;
		var current3;
		var current4;

		function extractInfo(indent, _line) {
			var res = {};
			if (_line.match(/См./)) debugger;
			var line = _line.slice(indent);
			var found = line.match(/\,\s\d/);
			if (found) {
				var vStarts = line.indexOf(found[0]);
				res.name = line.slice(0, vStarts > 0 ? vStarts : line.length).trim();
			} else {
				if (!line.match(/^[Сc]м\./)) {
					var dStarts = line.lastIndexOf('.');
					res.name = line.slice(0, dStarts).trim();
				} else {
					var long = line.match(/^[Сc]м\.\sтакже/);
					if (long) {
						line = line.slice(long[0].length)
					} else {
						line = line.slice(3);
					}

					res.ref = line.trim().split(';').map(function(ref) {
						var p = ref.split(',');
						var sub = p.slice(1);
						var res = {
							name: p[0].trim()
						};
						
						if (sub.length) {
							res.sub = sub[0].trim();
						}
						return res;
					});
				}
			}

			var verse = line.match(/((\d{1,2})[\.\,]?(\d{0,2}))(\s?-\s?(\d{1,2})?)?/g);
			if (verse) {
				var verst = res.verse = [];
				var vrs;
				for (var i = 0, len = verse.length; i < len; i++) {
					vrs = verse[i].match(/((\d{1,2})[\.\,]?(\d{0,2}))(\s?-\s?(\d{1,2})?)?/);
					var ch = parseInt(vrs[2], 10);
					var ves = parseInt(vrs[3], 10);
					var vee = vrs[5] && parseInt(vrs[5], 10);
					if (vee) {
						for (var k = ves; k <= vee; k++) {
							verst.push(ch + '.' + k);
						}
					} else {
						verst.push(ch + '.' + ves);
					}
				}
			}

			res.children = [];
			return res;
		}

		liner.on('readable', function() {
			while (line = liner.read()) {
				if (/^(\t){4}/.test(line)) {
					console.log(line);
					current4 = extractInfo(4, line);
					current3.children.push(current4);
				} else if (/^(\t){3}/.test(line)) {
					console.log(line);
					current3 = extractInfo(3, line);
					current2.children.push(current3);
				} else if (/^(\t){2}/.test(line)) {
					console.log(line);
					current2 = extractInfo(2, line);
					current1.children.push(current2);
				} else if (/^(\t){1}/.test(line)) {
					console.log(line);
					current1 = extractInfo(1, line);
					current.children.push(current1);
				} else if (/^[^\t]/.test(line)) {
					console.log(line);
					current = extractInfo(0, line);
					ctx.index.push(current);
				}
			}
		});
		liner.on('end', function() {
			if (!hasError)
				done();
		});
		liner.on('error', function(err) {
			hasError = true;
			done(err);
		});
	}
});

processFile.execute({
	list: list,
	bg: {}
}, function(err, ctx) {
	if (!err) {
		fs.writeFileSync('BGMCKN.json', JSON.stringify(ctx.bg));
	} else {
		console.log(err);
	}
});