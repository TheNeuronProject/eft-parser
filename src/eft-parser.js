import ESCAPE from './escape-parser.js'

const typeSymbols = '>#%@.-+'.split('')
const reserved = 'attached data element nodes methods subscribe unsubscribe update'.split(' ').map(i => `$${i}`)
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

const parseTag = (string) => {
	const [content, ...alias] = string.split('#')
	const [tag, ...classes] = content.split('.')
	return {
		tag,
		alias: alias.join('#'),
		class: classes.join(' ')
	}
}

const splitDefault = (string) => {
	string = string.substr(2, string.length - 4)
	const [_path, ..._default] = string.split('=')
	const pathArr = _path.trim().split('.')
	const defaultVal = ESCAPE(_default.join('=').trim())
	if (defaultVal) pathArr.push([defaultVal])
	return pathArr
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
	} else parts.push(string)
	return parts
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
			if (depth < minDepth || depth - prevDepth > 1 || (depth - prevDepth === 1 && ['comment', 'tag'].indexOf(prevType) === -1) || (prevType !== 'comment' && depth === minDepth && topExists)) throw new SyntaxError(getErrorMsg(`Indent grater than ${minDepth - 1} and less than ${prevDepth + 2} expected, but got ${depth}`, i))
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
						tag: info.tag,
						attr: {},
						prop: {},
						event: {}
					}]
					if (info.class) newNode[0].attr.class = info.class
					if (info.alias) newNode[0].alias = info.alias
					currentNode.push(newNode)
					currentNode = newNode
					break
				}
				case '#': {
					prevType = 'attr'
					const { name, value } = parseNodeProps(content)
					currentNode[0].attr[name] = value
					break
				}
				case '%': {
					prevType = 'prop'
					const { name, value } = parseNodeProps(content)
					currentNode[0].prop[name] = value
					break
				}
				case '@': {
					prevType = 'event'
					const { name, value } = parseNodeProps(content)
					if (typeof value !== 'string') throw new SyntaxError(getErrorMsg('Methods should not be wrapped in mustaches', i))
					currentNode[0].event[name] = value
					break
				}
				case '.': {
					prevType = 'text'
					const parts = parseText(content)
					currentNode.push(...parts)
					break
				}
				case '-': {
					if (reserved.indexOf(content) !== -1) throw new SyntaxError(getErrorMsg(`No reserved name '${content}' should be used`, i))
					prevType = 'node'
					currentNode.push({
						name: content,
						type: 'node'
					})
					break
				}
				case '+': {
					prevType = 'list'
					currentNode.push({
						name: content,
						type: 'list'
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
