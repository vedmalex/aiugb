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

// var list = fs.readdirSync('./');
// list = list.filter(function(fl) {
// 	return (path.extname(fl) === '.md' && fl.length == 4);
// }).map(function(f) {
// 	return {
// 		file: f,
// 		name: f.slice(0, 1)
// 	};
// });

var list = [{
	file: 'а.md',
	name: 'а'
}];
var pipe = require('pipeline.js');
debugger
var processFile = new pipe.Parallel({
	split: function(ctx) {
		return ctx.list.map(function(i) {
			return ctx.fork(i);
		});
	},
	stage: function(ctx, done) {
		var source = fs.createReadStream(ctx.file);
		var liner = new linereader();
		source.pipe(liner);
		var number = 0;
		var ln = 0;
		var hasError;
		liner.on('readable', function() {
			var line;
			while (line = liner.read()) {
				if (/^[^\t]/.test(line)){
					console.log(line);
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
	list: list
}, function(err, ctx) {
	if (!err) {
		fs.writeFileSync('BGMCKN.json', JSON.stringify(ctx.bg));
	} else {
		console.log(err);
	}
});