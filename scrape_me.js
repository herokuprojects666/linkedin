const Nick = require("nickjs")
const _ = require("underscore")
var parseArgs = require('minimist')

/** @todo: Cleanup and remove what isn't needed before adding readme */

const nick = new Nick()
const defaultCount = 50
const defaultTimeout = 20000

let count = 0
let currentUrl = undefined
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

function getIndexes(arg, cb) {
  var filteredElements = $('.results-list li').filter(function(element) {
    return $(this).find(arg.selector).length
  })
  var indexes = $(filteredElements).map(function(element) {
    return $(this).index()
  })  
  return cb(null, $.makeArray(indexes))
}

/** Used for debug purposes to get a list of all the names that are added, skipped, etc */
function getNames(indexes, cb) {
	return cb(null, [])
	var test = $.makeArray(indexes)
	if (!test.length) {
		return cb(null, [])
	}
  var filteredElements = $('.results-list li').filter(function(element) {
    return indexes.includes($(this).index())
  })
  var names = $(filteredElements).map(function(element) {
    return $(this).find('.actor-name').html()
  })
  return cb(null, $.makeArray(names))
}

/** Separates all the users on the page into disabled, enabled, and in-mail (premium) categories */
async function findElements(tab, count=10) {
	try {
		await tab.waitUntilPresent('.results-list li')
	}
	catch (e) {
		count--
		/** Linkedin fails to load at random so if that happens try to reload the page. After 10 reloads we are essentially in an unrecoverable state so exit at that point. */
		if (count && currentUrl) {
			console.log('Failed to find elements. Attempting page reload.')
			await tab.open(currentUrl)
			return recursivePromise(tab)
		}
		else {
			console.log('Page failed to load after 10 * max timeouts. Exiting.')
			return nick.exit()
		}
	}

	/** needed in order to trigger the content to show. All the content is hidden away in Ember virtual dom until its scrolled into view */
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
 //  console.log('in mail is ', inMailIndexes)
	// var inMailNames = await tab.evaluate(getNames, inMailIndexes)
  // console.log('in mail names are ', inMailNames)
  var disabledIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions button:disabled'})
  // console.log('disabled is ', disabledIndexes)
  // var disabledNames = await tab.evaluate(getNames, disabledIndexes)
  // console.log('disableds names are ', disabledNames)
  var enabledIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions button:enabled:not(.message-anywhere-button)'})
  // var enabledNames = await tab.evaluate(getNames, enabledIndexes)
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
	if (!count || !indexes) {
		resolve()
		return
	}
	if (indexes.length) {
		var index = indexes.shift()
		console.log('count is ', count)
		await tab.waitUntilPresent('li.active')
		await tab.waitUntilPresent('.results-list li:nth-child(' + (+index + 1) + ') .search-result__actions button')
		await tab.click('.results-list li:nth-child(' + (+index + 1) + ') .search-result__actions button')
		try {
			await tab.waitUntilPresent(".send-invite__header [type*='cancel-icon']", defaultTimeout)
		}
		catch (Exception) {
			e++
		}
		const isDisabled = await tab.evaluate(function(arg, cb) {
			return cb(null, $('.button-primary-large.ml1').is(':disabled'))
		})
		if (isDisabled) {
			try {
				await tab.click(".send-invite__header [type*='cancel-icon']")
			}
			catch (Exception) {
				e++
			}
		}
		else {
			try {
				await tab.click('.button-primary-large.ml1')
			}
			catch (Exception) {
				e++
			}
		}
		try {
			await tab.waitWhilePresent(".send-invite__header [type*='cancel-icon']", defaultTimeout)
		}
		catch (Exception) {
			e++
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
			/** Unfortunately, this bit fails on rare occassions. Skip what should be the next page and click on the "next" next page instead */
			try {
				await tab.waitWhilePresent('.search-is-loading', defaultTimeout)
			}
			catch (Exception) {
				await tab.evaluate(function(arg, cb) {
					$('.page-list ol li').eq((+arg.index) + 2).find('button').click()
					return cb(null, null)
			}, {index: currentIndex})
			}
			currentUrl = await(tab.getUrl())
			console.log('new url is ', currentUrl)
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
	console.log("Job completed. Existing.")
	nick.exit()
})