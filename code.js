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

var processFile = new pipe.Parallel({
	split: function(ctx) {
		return ctx.list.map(function(i) {
			var res = ctx.fork(i);
			res.children = res.bg[i.name] = [];
			return res;
		});
	},
	stage: function(ctx, done) {
		var source = fs.createReadStream(ctx.file);
		var liner = new linereader();
		source.pipe(liner);
		var ln = 0;
		var hasError;
		var line;
		var current = [ctx];

		function extractInfo(indent, _line) {
			var res = {};
			var line = _line.slice(indent);
			var found = line.match(/\,\s\d/);
			if (found) {
				var vStarts = line.indexOf(found[0]);
				res.name = line.slice(0, vStarts > 0 ? vStarts : line.length).trim();
			} else {
				if (!line.match(/^[Сс]м\./)) {
					var dStarts = line.lastIndexOf('.');
					res.name = line.slice(0, dStarts).trim();
				} else {
					var long = line.match(/^[Сс]м\.\sтакже/);
					if (long) {
						line = line.slice(long[0].length);
					} else {
						line = line.slice(3);
					}

					res.ref = line.trim().split(';').map(function(ref) {
						var p = ref.split(',');
						var sub = p.slice(1);
						var res = {
							name: p[0].trim()
						};
						if (!ctx.refee.hasOwnProperty(res.name)) {
							ctx.refee[res.name] = {
								count: 0,
								where: []
							};
						}

						var refee = ctx.refee[res.name];
						refee.count++;
						if (!refee.where) refee.where = [];
						refee.where.push({
							line: ln,
							file: ctx.file
						});

						if (sub.length) {
							res.sub = sub[0].trim();
							if (!refee.sub) {
								refee.sub = {};
							}
							if (!refee.sub.hasOwnProperty(res.sub)) {
								refee.sub[res.sub] = 0;
							}
							refee.sub[res.sub] ++;
						}
						return res;
					});
				}
			}
			if (res.name && res.name.match(/См\./))
				console.log(ln, ctx.file);

			if (res.name == "опред.") {
				res.def = true;
				// delete res.name;
			}

			// санскрит
			if (res.name) {
				var syn = res.name.match(/ \(.*?\)/g);
				if (syn) {

					res.name = res.name.replace(/ \(.*?\)/, "", "g");
					res.syn = syn.map(function(item) {
						return item.trim().replace(/\(/, "", 'g').replace(/\)/, "", 'g');
					});
				}
			}

			if (res.name) {
				res.name = res.name.replace(/\,$/, "");
			}

			if (indent === 0) {
				if (ctx.refs[res.name])
					ctx.refs[res.name] ++;
				else
					ctx.refs[res.name] = 1;
			}

			// поправить регулярку чтобы она не кушала лишние символы....
			var verse = line.match(/((\d{1,2})[\.\,]?(\d{0,2}))(\s?[-—]\s?(\d{1,2})?)?/g);
			if (verse) {
				var verst = res.verse = [];
				var vrs;
				for (var i = 0, len = verse.length; i < len; i++) {
					vrs = verse[i].match(/((\d{1,2})[\.\,]?(\d{0,2}))(\s?[-—]\s?(\d{1,2})?)?/);
					var ch = parseInt(vrs[2], 10);
					var ves = parseInt(vrs[3], 10);
					var vee = vrs[5] && parseInt(vrs[5], 10);
					if (vee) {
						for (var k = ves; k <= vee; k++) {
							verst.push(ch + '.' + k);
						}
					} else {
						if (ves)
							verst.push(ch + '.' + ves);
						else
							verst.push(ch);
					}
				}
			}
			return res;
		}

		liner.on('readable', function() {
			while (line = liner.read()) {
				try {
					ln++;
					var indent = line.match(/\t/g);
					indent = Array.isArray(indent) ? indent.length : 0;
					// console.log(line);
					cur = indent + 1;

					var ei = extractInfo(indent, line);
					if (!ei.def) {
						//если определение то не нужно создавать узел, нужно просто номера стихов
						current[cur] = ei;
						var p = current[indent];
						if (!p.hasOwnProperty('children')) p.children = [];
						current[indent].children.push(current[cur]);
						for (var i = cur + 1, len = current.length; i < len; i++) {
							current[i] = undefined;
						}
					} else {
						current[indent].verse = ei.verse;
					}
				} catch (e) {
					console.log(ln, ctx.file);
					throw e;
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

var processGloss = new pipe.Parallel({
	split: function(ctx) {
		return ctx.gloss.map(function(i) {
			var res = ctx.fork(i);
			res.children = res.bg[i.name] = [];
			return res;
		});
	},
	stage: function(ctx, done) {
		var source = fs.createReadStream(ctx.file);
		var liner = new linereader();
		source.pipe(liner);
		var ln = 0;
		var hasError;
		var line;
		var current = [ctx];

		function extractInfo(indent, _line) {
			var res = {};
			var line = _line.slice(indent);
			if (!line.match(/^[Сс]м\./)) {
				res.name = line.trim();
			} else {
				var long = line.match(/^[Сс]м\.\sтакже/);
				if (long) {
					line = line.slice(long[0].length);
				} else {
					line = line.slice(3);
				}

				res.ref = line.trim().split(',').map(function(ref) {
					var p = ref.split(',');
					var sub = p.slice(1);
					var res = {
						name: p[0].trim()
					};
					if (!ctx.refee.hasOwnProperty(res.name)) {
						ctx.refee[res.name] = {
							count: 0,
							where: []
						};
					}

					var refee = ctx.refee[res.name];
					refee.count++;
					if (!refee.where) refee.where = [];
					refee.where.push({
						line: ln,
						file: ctx.file
					});

					if (sub.length) {
						res.sub = sub[0].trim();
						if (!refee.sub) {
							refee.sub = {};
						}
						if (!refee.sub.hasOwnProperty(res.sub)) {
							refee.sub[res.sub] = 0;
						}
						refee.sub[res.sub] ++;
					}
					return res;
				});
			}

			// санскрит
			if (res.name && indent === 0) {
				var syn = res.name.match(/ \(.*?\)/g);
				if (syn) {

					res.name = res.name.replace(/ \(.*?\)/, "", "g");
					res.syn = syn.map(function(item) {
						return item.trim().replace(/\(/, "", 'g').replace(/\)/, "", 'g');
					});
				}
			}

			if (res.name) {
				res.name = res.name.replace(/\,$/, "");
			}

			if (indent === 0) {
				if (ctx.refs[res.name])
					ctx.refs[res.name] ++;
				else
					ctx.refs[res.name] = 1;
			}

			return res;
		}

		liner.on('readable', function() {
			while (line = liner.read()) {
				try {
					ln++;
					var indent = line.match(/\t/g);
					indent = Array.isArray(indent) ? indent.length : 0;
					// console.log(line);
					cur = indent + 1;

					var ei = extractInfo(indent, line);
					if (!ei.def) {
						//если определение то не нужно создавать узел, нужно просто номера стихов
						current[cur] = ei;
						var p = current[indent];
						if (!p.hasOwnProperty('children')) p.children = [];
						current[indent].children.push(current[cur]);
						for (var i = cur + 1, len = current.length; i < len; i++) {
							current[i] = undefined;
						}
					} else {
						current[indent].verse = ei.verse;
					}
				} catch (e) {
					console.log(ln, ctx.file);
					throw e;
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

var extractor = require('./extractor.js').extractor;
var Deque = require("double-ended-queue");

var runner = new pipe.Pipeline([
	processFile,
	processGloss,
	function(ctx) {
		extractor({
			source: ctx.bg,
			map: function(emit, value) {
				var queue = new Deque();

				function getItem(item) {
					if (item.hasOwnProperty('name')) {
						queue.push(item.name);
					}
					if (item.hasOwnProperty('children')) {
						item.children.forEach(getItem);
					}
					if (item.hasOwnProperty('verse')) {
						item.verse.forEach(function(verse) {
							emit(verse, queue.toString());
						});
					}
					if (item.hasOwnProperty('name')) {
						queue.pop();
					}
				}
				value.forEach(getItem);
			},
			reduce: function(key, value) {
				return value;
			},
			out: function(key, value) {
				return {
					verse: key,
					themes: value
				};
			},
			callback: function(err, data) {
				ctx.content = data.sort(function(a, b) {
					debugger;
					// a < b = -1
					// a > b = 1
					// a == b = 1
					var ac = String(a.verse).split('.');
					var bc = String(b.verse).split('.');
					ac0 = parseInt(ac[0], 10);
					ac1 = parseInt(ac[1] || "0", 10);
					bc0 = parseInt(bc[0], 10);
					bc1 = parseInt(bc[1] || "0", 10);
					if (ac.length == 2) {
						if (bc.length == 2) {
							if (ac0 > bc0) return 1;
							if (ac0 < bc0) return -1;
							if (ac0 == bc0) {
								if (ac1 > bc1) return 1;
								if (ac1 < bc1) return -1;
								if (ac1 == bc1) return 0;
							}
						}
						if (bc.length == 1) {
							if (ac0 > bc0) return 1;
							if (ac0 < bc0) return -1;
							if (ac0 == bc0) return -1;
						}
					}
					if (ac.length == 1) {
						if (bc.length == 2) {
							if (ac0 > bc0) return 1;
							if (ac0 < bc0) return -1;
							if (ac0 == bc0) return 1;
						}
						if (bc.length == 1) {
							if (ac0 > bc0) return 1;
							if (ac0 < bc0) return -1;
							if (ac0 == bc0) return 0;
						}
					}
				});
			}
		});
	},
	function(ctx) {
		for (var name in ctx.refee) {
			if (!ctx.refs.hasOwnProperty(name)) {
				ctx.notFound[name] = true;
			}
		}
	}
]);

runner.execute({
	list: list,
	gloss: gloss,
	bg: {},
	refs: {},
	refee: {},
	notFound: {}
}, function(err, ctx) {
	if (!err) {
		fs.writeFileSync('AIUBG.json', JSON.stringify(ctx.bg));
		fs.writeFileSync('REFS.json', JSON.stringify(ctx.refs));
		fs.writeFileSync('REFEE.json', JSON.stringify(ctx.refee));
		fs.writeFileSync('NF.json', JSON.stringify(ctx.notFound));
		fs.writeFileSync('content.json', JSON.stringify(ctx.content));
		// fs.writeFileSync('UWAIUBG.json', JSON.stringify(unwind(ctx.bg)));
	} else {
		console.log(err);
	}
});