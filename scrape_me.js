const Nick = require("nickjs")
const _ = require("underscore")
var parseArgs = require('minimist')

/** @todo: Cleanup and remove what isn't needed before adding readme */

const nick = new Nick()
const defaultCount = 50
const defaultTimeout = 20000

let count = 0
let url = undefined
let session = undefined
let e = 0
const parsedArgs = _.omit(parseArgs(process.argv), ['_'])

if (parsedArgs.c) {
	count = parsedArgs.c
}
if (parsedArgs.count) {
	count = parsedArgs.count
}
if (!parsedArgs.url && !parsedArgs.u) {
	throw new Error('Missing url argument. Please supply it via -u or --url')
}
if(!parsedArgs.s && !parsedArgs.session) {
	throw new Error('Missing session argument. Please supply it via -s or --session')
}
if (parsedArgs.u) {
	url = parsedArgs.u
}
if (parsedArgs.url) {
	url = parsedArgs.url
}
if (parsedArgs.s) {
	session = parsedArgs.s
}
if (parsedArgs.session) {
	session = parsedArgs.session
}

function getIndex(indexes, i) {
  return _.reduce(indexes, function(accumulator, element, index) {
    if (element == i) {
      return index
    }
    return accumulator
  }, 0)
}

function getIndexes(arg, cb) {
  var filteredElements = $('.results-list li').filter(function(element) {
    return $(this).find(arg.selector).length
  })
  var indexes = $(filteredElements).map(function(element) {
    return $(this).index()
  })  
  return cb(null, $.makeArray(indexes))
}

function getNames(indexes, cb) {
  var filteredElements = $('.results-list li').filter(function(element) {
    return indexes.contains($(this).index())
  })
  var names = $(filteredElements).map(function(element) {
    return $(this).find('.actor-name').html()
  })
  return cb(null, $.makeArray(names))
}

async function findElements(tab) {
	await tab.waitUntilPresent('.results-list li')
	/** needed in order to trigger the content to show. All the content is hidden away Ember virtual dom until its scrolled into view */
	await tab.scroll(0, 500)
	await tab.scroll(0, 1000)
	await tab.scroll(0, 1500)
	await tab.scroll(0, 2000)
	await tab.scroll(0, 2500)
	await tab.scroll(0, 3000)
	await tab.scroll(0, 3500)
	await tab.scroll(0, 4000)
	const selectorLength = await tab.evaluate(function(arg, cb) {
		const length = document.querySelectorAll('.results-list li').length
		return cb(null, length)
	})
  var inMailIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions--primary a'})
  // console.log('in mail is ', inMailIndexes)
	var inMailNames = await tab.evaluate(getNames, inMailIndexes)
  // console.log('in mail names are ', inMailNames)
  var disabledIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions button:disabled'})
  // console.log('disabled is ', disabledIndexes)
  var disabledNames = await tab.evaluate(getNames, disabledIndexes)
  // console.log('disableds names are ', disabledNames)
  var enabledIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions button:enabled:not(.message-anywhere-button)'})
  console.log('enabled is ', enabledIndexes)
  var enabledNames = await tab.evaluate(getNames, enabledIndexes)
  console.log('enabled names are ', enabledNames)
  var iterable = _.range(selectorLength)
  return {
  	iterable,
  	inMail: inMailIndexes,
  	disabled: disabledIndexes,
  	enabled: enabledIndexes
  }
}

async function recursivePromise(tab) {
	return new Promise(async function(resolve, reject) {
		const e = await new Promise(async function(r, rj) {
			r(findElements(tab))
		})
		recursiveUpdate.call(null, resolve, reject, e.enabled, e.iterable, tab)
	})
}

async function recursiveUpdate(resolve, reject, indexes, iterable, tab) {
	if (!count) {
		resolve()
	}
	if (indexes.length) {
		var index = indexes.shift()
		console.log('count is ', count)
		console.log('index is ', index)
		await tab.waitUntilPresent('li.active')
		await tab.waitUntilPresent('.results-list li:nth-child(' + (+index + 1) + ') .search-result__actions button')
		await tab.click('.results-list li:nth-child(' + (+index + 1) + ') .search-result__actions button')
		try {
			await tab.waitUntilPresent(".send-invite__header [type*='cancel-icon']", defaultTimeout)
		}
		catch (Exception) {
			e++
			await tab.screenshot('error-' + e + '.png')
		}
		const isDisabled = await tab.evaluate(function(arg, cb) {
			return cb(null, $('.button-primary-large.ml1').is(':disabled'))
		})
		console.log('is disabled is ', isDisabled)
		if (isDisabled) {
			try {
				await tab.click(".send-invite__header [type*='cancel-icon']")
			}
			catch (Exception) {
				e++
				await tab.screenshot('error-' + e + '.png')
			}
		}
		else {
			try {
				await tab.click('.button-primary-large.ml1')
			}
			catch (Exception) {
				e++
				await tab.screenshot('error-' + e + '.png')
			}
		}
		try {
			await tab.waitWhilePresent(".send-invite__header [type*='cancel-icon']", defaultTimeout)
		}
		catch (Exception) {
			e++
			await tab.screenshot('error-' + e + '.png')
		}

		count--
		recursiveUpdate.apply(null, arguments)
	}
	else {
		const lastIndex = await tab.evaluate(function(arg, cb) {
			const index = $('.page-list').find('li').last().index()
			return cb(null, index)
		})
		const currentIndex = await tab.evaluate(function(arg, cb) {
			const index = $('li.active').index()
			return cb(null, index)
		})
		if (+currentIndex < +lastIndex) {
			await tab.evaluate(function(arg, cb) {
				$('.page-list ol li').eq((+arg.index) + 1).find('button').click()
				return cb(null, null)
			}, {index: currentIndex})
			await tab.waitUntilPresent('.search-is-loading', defaultTimeout)
			await tab.waitWhilePresent('.search-is-loading', defaultTimeout)
			console.log('new url is ', await tab.getUrl())
			const e = await new Promise(async function(r, rj) {
				r(findElements(tab))
			})
			await recursiveUpdate(resolve, reject, e.enabled, e.iterable, tab)
		}
		else {
			resolve()
		}
	}
}

;(async () => {
	const tab = await nick.newTab()
	await nick.setCookie({
	  name: "li_at",
	  value: session,
	  domain: "www.linkedin.com"
	})
	await tab.open(url)

  await recursivePromise(tab)
})()
.then(() => {
	console.log("Job done!")
	nick.exit()
})