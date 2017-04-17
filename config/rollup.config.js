// Rollup plugins
const buble = require('rollup-plugin-buble')
const eslint = require('rollup-plugin-eslint')
const resolve = require('rollup-plugin-node-resolve')
const commonjs = require('rollup-plugin-commonjs')
const uglify = require('rollup-plugin-uglify')
const progress = require('rollup-plugin-progress')

module.exports = {
	moduleName: 'parseEft',
	entry: 'src/eft-parser.js',
	devDest: 'test/eft-parser.dev.js',
	proDest: 'dist/eft-parser.min.js',
	format: 'umd',
	sourceMap: 'inline',
	plugins: [
		progress({
			clearLine: false
		}),
		eslint(),
		resolve({
			jsnext: true,
			main: true,
			browser: true,
		}),
		commonjs(),
		buble({
			transforms: {
				modules: false,
				dangerousForOf: true
			},
			objedtAssign: 'Object.assign'
		}),
		(process.env.NODE_ENV === 'production' && uglify())
	]
}
