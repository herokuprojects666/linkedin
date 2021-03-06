const Nick = require("nickjs")
const _ = require("underscore")
var parseArgs = require('minimist')

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
  var filteredElements = $('.search-results__list  li').filter(function(element) {
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
  var filteredElements = $('.search-results__list  li').filter(function(element) {
    return indexes.includes($(this).index())
  })
  var names = $(filteredElements).map(function(element) {
    return $(this).find('.actor-name').html()
  })
  return cb(null, $.makeArray(names))
}

/** Separates all the users on the page into disabled, enabled, and in-mail (premium) categories */
async function findElements(tab) {
	await tab.inject('https://code.jquery.com/jquery-3.2.1.min.js')
	try {
		await tab.waitUntilPresent('.search-results__list  li')
	}
	catch (e) {
		/** Check if we clicked on a page with no search results [LinkedIn bug]. If there is an error, that means that the issue is something other than no results to show. */
		await tab.waitUntilPresent('.search-no-results__image-container', function(error) {
			if (!error) {
				nick.exit()
			}
		})
		count--
		/** Linkedin fails to load at random so if that happens try to reload the page. After 10 reloads we are essentially in an unrecoverable state so exit at that point. */
		if (count && currentUrl) {
			await tab.open(currentUrl)
			return recursivePromise(tab)
		}
		if (count && !currentUrl) {
			await tab.open(url)
			return recursivePromise(tab)
		}
		console.log('Page failed to load after 10 * max timeouts. Exiting.')
		return nick.exit()
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
		const length = document.querySelectorAll('.search-results__list li.search-result').length
		return cb(null, length)
	})
  var inMailIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions--primary a'})
  // var inMailNames = await tab.evaluate(getNames, inMailIndexes)
  var disabledIndexes = await tab.evaluate(getIndexes, {selector: '.search-result__actions button:disabled'})
  // var disabledNames = await tab.evaluate(getNames, disabledIndexes)
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
		await tab.waitUntilPresent('li.active')
		await tab.waitUntilPresent('.search-results__list li.search-result:nth-child(' + (+index + 1) + ') .search-result__actions button')
		await tab.click('.search-results__list li.search-result:nth-child(' + (+index + 1) + ') .search-result__actions button')
		try {
			await tab.waitUntilPresent(".artdeco-button--3", defaultTimeout)
		}
		catch (Exception) {
			e++
		}
		try {
			await tab.click('.artdeco-button--3.artdeco-button--primary')
		}
		catch (Exception) {
			e++
		}
		try {
			await tab.waitWhilePresent('.artdeco-button--3.artdeco-button--primary', defaultTimeout)
		}
		catch (Exception) {
			e++
		}
		count--
		console.log('count is ', count)
		recursiveUpdate.apply(null, arguments)
	}
	else {
		await tab.inject('https://code.jquery.com/jquery-3.2.1.min.js')
		const lastIndex = await tab.evaluate(function(arg, cb) {
			const index = $('.artdeco-pagination').find('li').last().index()
			return cb(null, index)
		})
		const currentIndex = await tab.evaluate(function(arg, cb) {
			const index = $('li.active').index()
			return cb(null, index)
		})
		if (+currentIndex < +lastIndex) {
			await tab.evaluate(function(arg, cb) {
				$('.artdeco-pagination ul li').eq((+arg.index) + 1).find('button').click()
				return cb(null, null)
			}, {index: currentIndex})
			await tab.wait(4000);
			currentUrl = await(tab.getUrl())
			const page = currentUrl.match(/(page=)[0-9]+/)
			/** Any page after 100 will never load [more than 1000 resuts]. Exit early if we hit page 101. */
			if (page && page.length && +(page[0].replace('page=', '')) > 100) {
				console.log('max page of 100 reached. Exiting early')
				nick.exit()
				return
			}
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
	/** This seems like something that should succeed 100% with a valid session but it doesn't. ballz. */
	try {
		await tab.open(url)
	}
	catch (e) {
		nick.exit()
		return
	}
	await recursivePromise(tab)

})()
.then(() => {
	console.log("Job completed. Existing.")
	nick.exit()
})