// Rollup plugins
import {eslint} from 'rollup-plugin-eslint'
import {terser} from 'rollup-plugin-terser'
import buble from '@rollup/plugin-buble'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import progress from 'rollup-plugin-progress'

export default {
	input: 'src/eft-parser.js',
	output: {
		name: 'parseEft',
		format: 'umd',
		sourcemap: true,
	},
	devDest: 'test/eft-parser.dev.js',
	proDest: 'dist/eft-parser.min.js',
	plugins: [
		progress({
			clearLine: false
		}),
		eslint(),
		resolve({
			browser: true,
		}),
		commonjs(),
		buble({
			transforms: {
				modules: false,
				dangerousForOf: true
			},
			objectAssign: 'Object.assign'
		}),
		(process.env.NODE_ENV === 'production' && terser())
	]
}
