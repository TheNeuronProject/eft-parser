// Set the escape character
const escapeChar = '&'
const doubleEscapeChar = escapeChar + escapeChar

// Initlize RegExp
const oct = new RegExp(`\\${escapeChar}[0-7]{1,3}`, 'g')
const ucp = new RegExp(`\\${escapeChar}u\\[.*?\\]`, 'g')
const uni = new RegExp(`\\${escapeChar}u.{0,4}`, 'g')
const hex = new RegExp(`\\${escapeChar}x.{0,2}`, 'g')
const esc = new RegExp(`\\${escapeChar}`, 'g')
const b = new RegExp(`\\${escapeChar}b`, 'g')
const t = new RegExp(`\\${escapeChar}t`, 'g')
const n = new RegExp(`\\${escapeChar}n`, 'g')
const v = new RegExp(`\\${escapeChar}v`, 'g')
const f = new RegExp(`\\${escapeChar}f`, 'g')
const r = new RegExp(`\\${escapeChar}r`, 'g')

// Escape octonary sequence
const O2C = () => {
	throw new SyntaxError('Octal escape sequences are not allowed in EFML.')
}

// Escape unicode code point sequence
const UC2C = (val) => {
	val = val.substr(3, val.length - 4)
	val = parseInt(val, 16)
	if (!val) throw new SyntaxError('Invalid Unicode escape sequence')
	try {
		return String.fromCodePoint(val)
	} catch (err) {
		throw new SyntaxError('Undefined Unicode code-point')
	}
}

// Escape unicode sequence
const U2C = (val) => {
	val = val.substring(2)
	val = parseInt(val, 16)
	if (!val) throw new SyntaxError('Invalid Unicode escape sequence')
	return String.fromCharCode(val)
}

// Escape hexadecimal sequence
const X2C = (val) => {
	val = `00${val.substring(2)}`
	val = parseInt(val, 16)
	if (!val) throw new SyntaxError('Invalid hexadecimal escape sequence')
	return String.fromCharCode(val)
}

const efEscape = (string) => {
	// Split strings
	const splitArr = string.split(doubleEscapeChar)
	const escaped = []

	// Escape all known escape characters
	for (let i of splitArr) {
		const escapedStr = i
			.replace(oct, O2C)
			.replace(ucp, UC2C)
			.replace(uni, U2C)
			.replace(hex, X2C)
			.replace(b, '\b')
			.replace(t, '\t')
			.replace(n, '\n')
			.replace(v, '\v')
			.replace(f, '\f')
			.replace(r, '\r')
			// Remove all useless escape characters
			.replace(esc, '')
		escaped.push(escapedStr)
	}
	// Return escaped string
	return escaped.join(escapeChar)
}

const checkEscape = string => string[string.length - 1] === escapeChar

const splitWith = (string, char) => {
	const splitArr = string.split(char)
	const escapedSplit = []
	let escaped = false
	for (let i of splitArr) {
		if (escaped) escapedSplit[escapedSplit.length - 1] += `${char}${i}`
		else escapedSplit.push(i)
		escaped = checkEscape(i)
	}
	return escapedSplit
}

const splitBy = (string, char) => {
	const splitArr = string.split(doubleEscapeChar)
	const escaped = splitWith(splitArr.shift(), char)
	for (let i of splitArr) {
		const escapedSplit = splitWith(i, char)
		escaped[escaped.length - 1] += `${doubleEscapeChar}${escapedSplit.shift()}`
		escaped.push(...escapedSplit)
	}
	return escaped
}

export { efEscape, splitBy }
