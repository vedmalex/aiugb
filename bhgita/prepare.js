var bgmap = require('./fastSearch.js')();

var fs = require('fs-extra');
var yaml = require('js-yaml');

var folders = [{
	folder: 'bg_en_v2/',
	lang: 'EN',
	name: 'BG ',
	devanagari: true,
	sanskrit: true,
	wbw: true,
	translation: true,
	purport: true,
}, {
	folder: 'bg_ru_v4/',
	lang: 'RU',
	name: 'БГ ',
	wbw: true,
	sanskrit: true,
	translation: true,
	purport: true
}, {
	folder: 'yamls/',
	lang: 'MCKN',
	name: 'ССЗ ',
	translation: true,
	purport: true
}];

var bf = 'book';

var keys = {};

var f;
for (var i = 0, len = folders.length; i < len; i++) {
	f = folders[i];
	for (var ch = 1; ch < 19; ch++) {
		var chnum = ch < 10 ? '0' + String(ch) : String(ch);
		var file = fs.readFileSync(f.folder + 'ch' + chnum + '.yaml');
		var chap = yaml.load(file);
		if (!keys[chnum]) {
			debugger;
			keys[chnum] = Object.keys(chap).map(function(vm) {
				var vms;
				var vmt;
				var ref;
				if (vm.indexOf('-') > -1) {
					ref = vm.split('-');
				} else {
					ref = [vm];
				}
				vmt = ref[0];
				vms = ref.map(function(it) {
					return ('0' + it).slice(-2);
				}).join(',');

				return {
					original: vm,
					sort: vms,
					ref: ref,
					tt: vmt,
					part: bgmap[chnum][vmt],
					chapter: chnum
				};
			});

			keys[chnum] = keys[chnum].sort(function(a, b) {
				if (a.sort > b.sort) return 1;
				else if (a.sort < b.sort) return -1;
				else return 1;
			});
		}

		var verses = keys[chnum];
		var verse;
		for (var j = 0, vlen = verses.length; j < vlen; j++) {
			verse = verses[j];
			if (chap[verse.original]) {
				if (f.devanagari) {
					var droot = bf + '/devanagari/' + chnum;
					fs.ensureDirSync(droot);
					var dn = chap[verse.original].devanagari;
					if (dn) {
						fs.writeFileSync(droot + '/' + verse.sort + '.md', dn.join('\n'));
					} else {
						// console.log('devanagari', f.lang, droot, verse.sort);
					}
				}

				if (f.sanskrit) {
					var sroot = bf + '/sanskrit/' + f.lang + '/' + chnum;
					fs.ensureDirSync(sroot);
					var sans = chap[verse.original].sanskrit;
					if (sans) {
						fs.writeFileSync(sroot + '/' + verse.sort + '.md', sans.join('\n\n'));
					} else {
						// console.log('sanskrit', f.lang, sroot, verse.sort);
					}
				}

				if (f.wbw) {
					var wbroot = bf + '/wbw/' + f.lang + '/' + chnum;
					fs.ensureDirSync(wbroot);
					var wbw = chap[verse.original].wbw;

					if (wbw) {
						var wbwa = [];
						for (var wk in wbw) {
							wbwa.push(wbw[wk].join(' - '));
						}
						fs.writeFileSync(wbroot + '/' + verse.sort + '.md', wbwa.join('; '));
					} else {
						// console.log('wbw', f.lang, wbroot, verse.sort);
					}
				}

				if (f.translation) {
					var troot = bf + '/translation/' + f.lang + '/' + chnum;
					fs.ensureDirSync(troot);
					var translation = chap[verse.original].translation;
					if (translation) {
						fs.writeFileSync(troot + '/' + verse.sort + '.md', translation);
					} else {
						// console.log('translation', f.lang, troot, verse.sort);
					}
				}

				if (f.purport) {
					var proot = bf + '/purport/' + f.lang + '/' + chnum;
					fs.ensureDirSync(proot);
					if (chap[verse.original]) {
						var purport = chap[verse.original].purport;
						if (purport) {
							var apurport = [];
							for (var pp in purport) {
								apurport.push(f.name + ch + '.' + verse.original + ':' + pp + '\t' + purport[pp]);
							}
							fs.writeFileSync(proot + '/' + verse.sort + '.md', apurport.join('\n\n'));
						} else {
						}
					}
				}
			} else {
				
							console.log('purport', f.lang, proot, verse.sort);
			}
		}
	}
}
fs.writeFileSync('keys.yaml', yaml.dump(keys));