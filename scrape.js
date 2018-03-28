var casper = require('casper').create();
var count = 5;

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
	count = contactCount
}

casper.start(url, function() {})

casper.run();