exports.extractor = function(options) {
	if (typeof options.callback == "function") {

		var procStart = new Date();
		var result = {};
		var output = [];
		var stats = {
			processTime: 0,
			counts: {
				emits: 0,
				inputs: 0,
				outputs: 0
			}
		};

		var out = options.out ||
			function(key, value) {
				return {
					_id: key,
					value: value
				};
			};

		var reduce = options.reduce ||
			function(key, value) {
				if (value.length > 1) {
					return value;
				} else {
					return values[0];
				}
			};

		var counts = stats.counts;

		function emit(key, value) {
			if (key === undefined) key = null;
			key = JSON.stringify(key);
			var res = result[key];
			if (!res) res = result[key] = [];
			res.push(value);
			counts.emits++;
		}

		if (options.source && (typeof options.map == "function")) {
			var keys = Object.keys(options.source);
			counts.inputs = keys.length;
			for (var i = 0, len = keys.length; i < len; i++) {
				try {
					options.map.call(null, emit, options.source[keys[i]]);
				} catch (err) {
					debugger;
					console.log(err);
					console.log(err.stack);
					return options.callback(err);
				}
			}

			for (var key in result) {
				try {
					var res = reduce(key, result[key]);
				} catch (err) {
					console.log(err);
					return options.callback(err);
				}
				output.push(out(JSON.parse(key), res));
			}

			stats.processTime = new Date() - procStart;
			counts.outputs = Object.keys(result).length;
			options.callback(null, output, stats);
		} else {
			options.callback(new Error('source is not defined or map in not a function'));
		}
	} else {
		throw new Error("callback is not a function");
	}
};

//TODO: использовать process.nextTick() для больших объемов данных.
//TODO: посмотреть как можно использовать RX.