var fs = require('fs');
var currentFile = require('system').args[3];
var casper = require('casper').create({
    viewportSize: {
      width: 2,
      height: 2
    },
    verbose: true,
    logLevel: "debug",
    pageSettings: {
    userAgent: 'User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
  }});

var currentPath = fs.absolute(currentFile).split('/')
  .filter(function(path, index, array) { return index < array.length - 1})
  .join('/') + '/';

var maxContactCount = 5;

/** User supplied arguments */
var contactCount = casper.cli.get('c')
var url = casper.cli.get('url')
var username = casper.cli.get('user')
var password = casper.cli.get('pw')

if (!url) {
  throw new Error('Missing required argument: url')
}
if (!username) {
  throw new Error('Missing required argument: user')
}
if (!password) {
  throw new Error('Missing required argument: pw')
}
if (contactCount) {
  maxContactCount = contactCount
}

/** Handy method I found in SO [sorry closed page so can't give credit] for finding scroll top */
function myScrollTo(top){
  this.evaluate(function(t){
      window.document.body.scrollTop = t;
  }, top);
}

/** @todo: account for captcha */
casper.start("https://www.linkedin.com/uas/login", function() {
  casper.capture(currentPath + 'veryinitial.png')
  /** Wait for form inputs to be visible */
  this.waitFor(function() {
    return this.evaluate(function() {
      return $('.form-email').find('input').length
    })
  })
  /** Send the user supplied values to the corresponding inputs */
  this.then(function() {
    this.sendKeys('.form-email input', username)
    this.sendKeys('.form-password input', password)
    this.sendKeys('.form-password input', casper.page.event.key.Enter)
  })

  /** Linkedin doesn't like our UA so wait until it tells us our browser sucks */
  this.waitFor(function() {
    return this.evaluate(function() {
      return document.querySelector("a[title='continue anyway']").title == 'continue anyway'
    })
  })

  /** Grab the href attribute for the funky browser detection and redirect to that ourselves */
  this.then(function() {
    var continueAnyway = this.getElementsInfo("a[title='continue anyway']")[0]
    this.thenOpen(continueAnyway.attributes.href)
  })

  /** Wait for the official login url */
  this.waitFor(function() {
    return this.getCurrentUrl() == 'https://www.linkedin.com/feed/'
  })

  /** Tada we are now logged in! target the url provided in the script */
  this.thenOpen(url)

  /** Wait till we have a selector length for the wrapper element for a contact */
  this.waitFor(function() {
    return this.evaluate(function() {
      return document.querySelector('.search-result__occluded-item').id
    })
  })

  /** 3300 is magic number we're looking for in order to trigger all the "hidden" emberjs markup to show that we need*/
  this.then(function() {
    myScrollTo.call(this, 3300)
  })

  this.then(function() {
    // require('utils').dump(this.getElementsInfo('.search-result__occluded-item'))
    this.each(this.getElementsInfo('.search-result__occluded-item'), function(casper, element, index) {
      console.log('html is ', element['html'])
    })
  })
})

casper.run();