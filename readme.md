I created this script with the assumption that all the required npm libraries would be stuck in global scope. With that in mind, you will need to install the following:
1) `nickjs`
2) `minimist`
3) `underscore`

You will also want to add the following to your bash profile (or whatever the equivalent is that you're using)
1) `export NODE_PATH=/usr/local/lib/node_modules` 
2) `export CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome`

These are the paths where node and chrome live respectfully. The paths my vary slightly on your system.

Finally, in order to run the script you will need to execute it in node. The bits you need to input are a bit gnarly so I would advise sticking those in your bash profile as well. Here is an example alias:

alias dev="node path/to/script -c 300 -u \"my_url\" -s \"cookie_session\""

`-c` is an optional parameter. It dicates how many contacts you want to add. It defaults to 50 if ommitted. It can also be passed through on `-count` flag. <br/>
`-u` is a required parameter. This is the beginning url that you want to scrape on. Example url: `https://www.linkedin.com/search/results/people/?facetGeoRegion=%5B%22us%3A34%22%5D&keywords=software%20manager&origin=FACETED_SEARCH&page=1. This can also be passed through on `-url` flag. <br/>
`-s` is a required paramter. This is the session cookie LinkedIn uses to determine if you're logged in. This can be found in dev tools by looking at the cookies and copy/pasting the value in `li_at` key.
