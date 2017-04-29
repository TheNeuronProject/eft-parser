import ESCAPE from './escape-parser.js'

const typeSymbols = '>#%@.-+'.split('')
const reserved = 'attached data element refs methods subscribe unsubscribe update destroy'.split(' ').map(i => `$${i}`)
const mustache = /\{\{.+?\}\}/g
const spaceIndent = /^(\t*)( *).*/
const hashref = /#([^}]|}[^}])*$/

const getErrorMsg = (msg, line = -2) => `Failed to parse eft template: ${msg}. at line ${line + 1}`

const isEmpty = string => !string.replace(/\s/, '')

const getOffset = (string, parsingInfo) => {
	if (parsingInfo.offset !== null) return
	parsingInfo.offset = string.match(/\s*/)[0]
	if (parsingInfo.offset) parsingInfo.offsetReg = new RegExp(`^${parsingInfo.offset}`)
}

const removeOffset = (string, parsingInfo, i) => {
	if (parsingInfo.offsetReg) {
		let removed = false
		string = string.replace(parsingInfo.offsetReg, () => {
			removed = true
			return ''
		})
		if (!removed) throw new SyntaxError(getErrorMsg(`Expected indent to be grater than 0 and less than ${parsingInfo.prevDepth + 1}, but got -1`, i))
	}
	return string
}

const getIndent = (string, parsingInfo) => {
	if (parsingInfo.indentReg) return
	const spaces = string.match(spaceIndent)[2]
	if (spaces) {
		parsingInfo.indentReg = new RegExp(spaces)
	}
}

const getDepth = (string, parsingInfo, i) => {
	let depth = 0
	if (parsingInfo.indentReg) string = string.replace(/^\s*/, str => str.replace(parsingInfo.indentReg, '\t'))
	const content = string.replace(/^\t*/, (str) => {
		depth = str.length
		return ''
	})
	if (/^\s/.test(content)) throw new SyntaxError(getErrorMsg('Bad indent', i))
	return { depth, content }
}

const resolveDepth = (ast, depth) => {
	let currentNode = ast
	for (let i = 0; i < depth; i++) currentNode = currentNode[currentNode.length - 1]
	return currentNode
}

const splitDefault = (string) => {
	string = string.slice(2, string.length - 2)
	const [_path, ..._default] = string.split('=')
	const pathArr = _path.trim().split('.')
	const defaultVal = ESCAPE(_default.join('=').trim())
	if (defaultVal) return [pathArr, defaultVal]
	return [pathArr]
}

const splitLiterals = (string) => {
	const strs = string.split(mustache)
	if (strs.length === 1) return ESCAPE(string)
	const tmpl = [strs.map(ESCAPE)]
	const mustaches = string.match(mustache)
	if (mustaches) tmpl.push(...mustaches.map(splitDefault))
	return tmpl
}

const pushStr = (textArr, str) => {
	if (str) textArr.push(str)
}

const parseText = (string) => {
	const [strs, ...exprs] = splitLiterals(string)
	const textArr = []
	for (let i = 0; i < exprs.length; i++) {
		pushStr(textArr, strs[i])
		textArr.push(exprs[i])
	}
	pushStr(textArr, strs[strs.length - 1])
	return textArr
}

const dotToSpace = val => val.replace(/\./g, ' ')

const parseTag = (string) => {
	const tagInfo = {}
	const [tag, ...content] = string.replace(hashref, (val) => {
		tagInfo.ref = val.slice(1)
		return ''
	}).split('.')
	tagInfo.tag = tag
	tagInfo.class = splitLiterals(content.join('.'))
	if (typeof tagInfo.class === 'string') tagInfo.class = dotToSpace(tagInfo.class).trim()
	else tagInfo.class[0] = tagInfo.class[0].map(dotToSpace)
	return tagInfo
}

const parseNodeProps = (string) => {
	const splited = string.split('=')
	return {
		name: splited.shift().trim(),
		value: splitLiterals(splited.join('=').trim())
	}
}

const parseEvent = (string) => {
	const splited = string.split('=')
	return {
		name: splited.shift().trim(),
		value: splited.join('=').trim()
	}
}

const setOption = (options, option) => {
	switch (option) {
		case 'stop': {
			options.s = 1
			break
		}
		case 'stopImmediate': {
			options.i = 1
			break
		}
		case 'prevent': {
			options.p = 1
			break
		}
		case 'shift': {
			options.h = 1
			break
		}
		case 'alt': {
			options.a = 1
			break
		}
		case 'ctrl': {
			options.c = 1
			break
		}
		case 'meta': {
			options.t = 1
			break
		}
		case 'capture': {
			options.u = 1
			break
		}
		default: {
			console.warn(`Abandoned unsupported event option '${option}'.`)
		}
	}
}

const getOption = (options, keys, option) => {
	const keyCode = parseInt(option, 10)
	if (isNaN(keyCode)) return setOption(options, option)
	keys.push(keyCode)
}

const getEventOptions = (name) => {
	const options = {}
	const keys = []
	const [listener, ...ops] = name.split('.')
	options.l = listener
	for (let i of ops) getOption(options, keys, i)
	if (keys.length > 0) options.k = keys
	return options
}

const splitEvents = (string) => {
	const [name, ...value] = string.split(':')
	const content = value.join(':')
	if (content) return [name.trim(), splitLiterals(content)]
	return [name.trim()]
}

const parseLine = ({line, ast, parsingInfo, i}) => {
	if (isEmpty(line)) return
	getIndent(line, parsingInfo)
	getOffset(line, parsingInfo)

	let { depth, content } = getDepth(removeOffset(line, parsingInfo, i), parsingInfo, i)

	if (content) {
		if (depth < 0 || depth - parsingInfo.prevDepth > 1 || (depth - parsingInfo.prevDepth === 1 && ['comment', 'tag'].indexOf(parsingInfo.prevType) === -1) || (parsingInfo.prevType !== 'comment' && depth === 0 && parsingInfo.topExists)) throw new SyntaxError(getErrorMsg(`Expected indent to be grater than 0 and less than ${parsingInfo.prevDepth + 1}, but got ${depth}`, i))
		const type = content[0]
		content = content.slice(1)
		if (!parsingInfo.topExists && typeSymbols.indexOf(type) >= 0 && type !== '>') throw new SyntaxError(getErrorMsg('No top level entry', i))
		if (!content && typeSymbols.indexOf(type) >= 0) throw new SyntaxError(getErrorMsg('Empty content', i))
		// Jump back to upper level
		if (depth < parsingInfo.prevDepth || (depth === parsingInfo.prevDepth && parsingInfo.prevType === 'tag')) parsingInfo.currentNode = resolveDepth(ast, depth)
		parsingInfo.prevDepth = depth

		switch (type) {
			case '>': {
				if (!parsingInfo.topExists) {
					parsingInfo.topExists = true
					parsingInfo.minDepth = depth
				}
				const info = parseTag(content)
				const newNode = [{
					t: info.tag
				}]
				if (info.class) {
					newNode[0].a = {}
					newNode[0].a.class = info.class
				}
				if (info.ref) newNode[0].r = info.ref
				parsingInfo.currentNode.push(newNode)
				parsingInfo.currentNode = newNode
				parsingInfo.prevType = 'tag'
				break
			}
			case '#': {
				const { name, value } = parseNodeProps(content)
				if (!parsingInfo.currentNode[0].a) parsingInfo.currentNode[0].a = {}
				parsingInfo.currentNode[0].a[name] = value
				parsingInfo.prevType = 'attr'
				break
			}
			case '%': {
				const { name, value } = parseNodeProps(content)
				if (!parsingInfo.currentNode[0].p) parsingInfo.currentNode[0].p = {}
				parsingInfo.currentNode[0].p[name] = value
				parsingInfo.prevType = 'prop'
				break
			}
			case '@': {
				const { name, value } = parseEvent(content)
				if (!parsingInfo.currentNode[0].e) parsingInfo.currentNode[0].e = []
				const options = getEventOptions(name)
				const [method, _value] = splitEvents(value)
				options.m = method
				if (_value) options.v = _value
				parsingInfo.currentNode[0].e.push(options)
				parsingInfo.prevType = 'event'
				break
			}
			case '.': {
				parsingInfo.currentNode.push(...parseText(content))
				parsingInfo.prevType = 'text'
				break
			}
			case '-': {
				if (reserved.indexOf(content) !== -1) throw new SyntaxError(getErrorMsg(`Reserved name '${content}' should not be used`, i))
				parsingInfo.currentNode.push({
					n: content,
					t: 0
				})
				parsingInfo.prevType = 'node'
				break
			}
			case '+': {
				parsingInfo.currentNode.push({
					n: content,
					t: 1
				})
				parsingInfo.prevType = 'list'
				break
			}
			default: {
				parsingInfo.prevType = 'comment'
			}
		}
	}
}

const parseEft = (template) => {
	if (!template) throw new TypeError(getErrorMsg('Template required, but nothing present'))
	const tplType = typeof template
	if (tplType !== 'string') throw new TypeError(getErrorMsg(`Expected a string, but got a(n) ${tplType}`))
	const lines = template.split(/\r?\n/)
	const ast = []
	const parsingInfo = {
		indentReg: null,
		prevDepth: 0,
		offset: null,
		offsetReg: null,
		prevType: 'comment',
		currentNode: ast,
		topExists: false,
	}
	for (let i = 0; i < lines.length; i++) parseLine({line: lines[i], ast, parsingInfo, i})

	if (ast[0]) return ast[0]
	throw new SyntaxError(getErrorMsg('Nothing to be parsed', lines.length - 1))
}

export default parseEft
