import ESCAPE from './escape-parser.js'

const typeSymbols = '>#%@.-+'.split('')
const reserved = 'attached data element nodes methods subscribe unsubscribe update destroy'.split(' ').map(i => `$${i}`)
const fullMustache = /^\{\{.*\}\}$/
const mustache = /\{\{.+?\}\}/g
const spaceIndent = /^(\t*)( *).*/
const stopExp = /\.stop(?=\.|$)/g
const stopImmediateExp = /\.stopImmediate(\.|$)/g
const preventExp = /\.prevent(\.|$)/g

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
	string = string.substr(2, string.length - 4)
	const [_path, ..._default] = string.split('=')
	const pathArr = _path.trim().split('.')
	const defaultVal = ESCAPE(_default.join('=').trim())
	if (defaultVal) return [pathArr, defaultVal]
	return [pathArr]
}

const parseTag = (string) => {
	const [content, ...name] = string.split('#')
	const [tag, ...classes] = content.split('.')
	const classValue = classes.join('.')
	if (fullMustache.test(classValue)) return {
		tag,
		name: name.join('#'),
		class: splitDefault(classValue)
	}
	return {
		tag,
		name: name.join('#'),
		class: classes.join(' ')
	}
}

const parseNodeProps = (string) => {
	const splited = string.split('=')
	const name = splited.shift().trim()
	const value = splited.join('=').trim()
	if (fullMustache.test(value)) return { name, value: splitDefault(value) }
	return { name, value: ESCAPE(value) }
}

const parseText = (string) => {
	const parts = []
	const mustaches = string.match(mustache)
	if (mustaches) {
		const texts = string.split(mustache)
		for (let i = 0; i < texts.length; i++) {
			if (texts[i]) parts.push(ESCAPE(texts[i]))
			if (mustaches[i]) parts.push(splitDefault(mustaches[i]))
		}
	} else parts.push(ESCAPE(string))
	return parts
}

const getEventOptions = (name) => {
	let stop = false
	let stopImmediate = false
	let prevent = false
	const listener = name.replace(stopExp, () => {
		stop = true
		return ''
	})
	.replace(stopImmediateExp, () => {
		stopImmediate = true
		return ''
	})
	.replace(preventExp, () => {
		prevent = true
		return ''
	})
	return { listener, stop, stopImmediate, prevent }
}

const splitEvents = (string) => {
	const [name, ...value] = string.split(':')
	const content = value.join(':')
	if (content) {
		if (fullMustache.test(content)) return [name.trim(), splitDefault(content)]
		return [name.trim(), ESCAPE(value.join(':'))]
	}
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
				if (info.name) newNode[0].n = info.name
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
				const { name, value } = parseNodeProps(content)
				if (typeof value !== 'string') throw new SyntaxError(getErrorMsg('Methods should not be wrapped in mustaches', i))
				if (!parsingInfo.currentNode[0].e) parsingInfo.currentNode[0].e = {}
				const { listener, stop, stopImmediate, prevent } = getEventOptions(name)
				const [method, _value] = splitEvents(value)
				const event = { m: method }
				if (stop) event.s = 1
				if (stopImmediate) event.i = 1
				if (prevent) event.p = 1
				if (_value) event.v = _value
				parsingInfo.currentNode[0].e[listener] = event
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

const eftParser = (template) => {
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

export default eftParser
