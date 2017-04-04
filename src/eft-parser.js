import ESCAPE from './escape-parser.js'

const typeSymbols = '>#%@.-+'.split('')
const reserved = 'attached data element nodes methods subscribe unsubscribe update destroy'.split(' ').map(i => `$${i}`)
const fullMustache = /^\{\{.*\}\}$/
const mustache = /\{\{.+?\}\}/g

const getErrorMsg = (msg, line = -2) => `Failed to parse eft template: ${msg}. at line ${parseInt(line, 10) + 1}`

const getDepth = (string) => {
	let depth = 0
	const content = string = string.replace(/^\t+/, (str) => {
		depth = str.length
		return ''
	})
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

const splitEvents = (string) => {
	const [name, ...value] = string.split(':')
	const content = value.join(':')
	if (content) {
		if (fullMustache.test(content)) return [name.trim(), splitDefault(content)]
		return [name.trim(), ESCAPE(value.join(':'))]
	}
	return [name.trim()]
}

const eftParser = (template) => {
	if (!template) throw new TypeError(getErrorMsg('Template required, but nothing present'))
		const tplType = Object.prototype.toString.call(template)
	if (tplType !== '[object String]') throw new TypeError(getErrorMsg(`Expected a string, but got an ${tplType}`))
	const lines = template.split(/\r?\n/)
	const ast = []
	let prevDepth = 0
	let minDepth = 0
	let prevType = 'comment'
	let currentNode = ast
	let topExists = false
	for (let i in lines) {
		let { depth, content } = getDepth(lines[i])

		if (content) {
			if (depth < minDepth || depth - prevDepth > 1 || (depth - prevDepth === 1 && ['comment', 'tag'].indexOf(prevType) === -1) || (prevType !== 'comment' && depth === minDepth && topExists)) throw new SyntaxError(getErrorMsg(`Expected indent to be grater than ${minDepth - 1} and less than ${prevDepth + 2}, but got ${depth}`, i))
			const type = content[0]
			content = content.slice(1)
			if (!topExists && typeSymbols.indexOf(type) >= 0 && type !== '>') throw new SyntaxError(getErrorMsg('No top level entry', i))
			if (!content && typeSymbols.indexOf(type) >= 0) throw new SyntaxError(getErrorMsg('Empty content', i))
			// Jump back to upper level
			if (depth < prevDepth || (depth === prevDepth && prevType === 'tag')) currentNode = resolveDepth(ast, depth)
			prevDepth = depth

			switch (type) {
				case '>': {
					if (!topExists) {
						topExists = true
						minDepth = depth
					}
					prevType = 'tag'
					const info = parseTag(content)
					const newNode = [{
						t: info.tag
					}]
					if (info.class) {
						newNode[0].a = {}
						newNode[0].a.class = info.class
					}
					if (info.name) newNode[0].n = info.name
					currentNode.push(newNode)
					currentNode = newNode
					break
				}
				case '#': {
					prevType = 'attr'
					const { name, value } = parseNodeProps(content)
					if (!currentNode[0].a) currentNode[0].a = {}
					currentNode[0].a[name] = value
					break
				}
				case '%': {
					prevType = 'prop'
					const { name, value } = parseNodeProps(content)
					if (!currentNode[0].p) currentNode[0].p = {}
					currentNode[0].p[name] = value
					break
				}
				case '@': {
					prevType = 'event'
					const { name, value } = parseNodeProps(content)
					if (typeof value !== 'string') throw new SyntaxError(getErrorMsg('Methods should not be wrapped in mustaches', i))
					if (!currentNode[0].e) currentNode[0].e = {}
					currentNode[0].e[name] = splitEvents(value)
					break
				}
				case '.': {
					prevType = 'text'
					const parts = parseText(content)
					currentNode.push(...parts)
					break
				}
				case '-': {
					if (reserved.indexOf(content) !== -1) throw new SyntaxError(getErrorMsg(`Reserved name '${content}' should not be used`, i))
					prevType = 'node'
					currentNode.push({
						n: content,
						t: 0
					})
					break
				}
				case '+': {
					prevType = 'list'
					currentNode.push({
						n: content,
						t: 1
					})
					break
				}
				default: {
					prevType = 'comment'
				}
			}
		}
	}

	if (ast[0]) return ast[0]
	throw new SyntaxError(getErrorMsg('Nothing to be parsed', lines.length - 1))
}

export default eftParser
