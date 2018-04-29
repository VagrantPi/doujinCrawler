// crawler
var Crawler = require("crawler");
var moment = require("moment");

// google calendar
const fs = require('fs');
const mkdirp = require('mkdirp');
const readline = require('readline');
const {google} = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'credentials.json';

var doujinEvents = []
var c = new Crawler({
    maxConnections : 100,
    callback : function (error, res, done) {
        if(error){
            console.log(error);
        }else{
            var $ = res.$;
            $('div[class="event_smi_info"]').each(function(index,item){
              let timeStart, timeEnd = ""
              title = $(this).find('strong.list_smi_title').text()
              timeString = $(this).find('ul.list_smi_lsit li').first().text()
              locationString = $(this).find('ul.list_smi_lsit li:nth-child(2)').text()
              eventUrl = $(this).find('ul.list_smi_lsit li:nth-child(3) a').attr('href')
              location = locationString.substring(5, locationString.length)
              timeFormat = timeString.substring(5, timeString.length - 3)
              if(timeFormat.length > 10) {
                timeFormats = timeFormat.split("(六) ~ ")
                timeStart = moment(timeFormats[0]).format();
                timeEnd = moment(timeFormats[1]).format();
              } else {
                timeStart = moment(timeFormat).format();
                timeEnd = moment(timeFormat).format();
              }
              doujinEvents.push({
                title,
                location,
                timeStart, 
                timeEnd,
                eventUrl
              })
            })
        }
        // console.log(doujinEvents[0])
        done();
    }
});

// Queue URLs with custom callbacks & parameters
c.queue('https://www.doujin.com.tw/events');

// Load client secrets from a local file.
setTimeout(function() {
  console.log(doujinEvents)
  fs.readFile('client_secret.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), addEvents);
  });
}, 3000);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function addEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});

  // var i = 1;
  // doujinEvents.forEach(function(value, index){
  for (var i = 0; i < doujinEvents.length; i++) {
    (function(i) {
      setTimeout(function() {
        var event = {
          'summary': doujinEvents[i].title,
          'location': doujinEvents[i].location,
          'description': doujinEvents[i].eventUrl,
          'start': {
            'dateTime': doujinEvents[i].timeStart,
            'timeZone': 'Asia/Taipei',
          },
          'end': {
            'dateTime': doujinEvents[i].timeEnd,
            'timeZone': 'Asia/Taipei',
          },
          'recurrence': [
            'RRULE:FREQ=DAILY;COUNT=1'
          ],
          'reminders': {
            'useDefault': false,
            'overrides': [
              // {'method': 'popup', 'minutes': 24 * 60},
              // {'method': 'popup', 'minutes': 2 * 24 * 60},
            ],
          },
        };
      
        calendar.events.insert({
          auth: auth,
          calendarId: '<your calendarId>',
          resource: event,
        }, function(err, event) {
          if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
          }
          console.log('Event created: %s', event.data.htmlLink);
        });
      }, 1000 * i);
    })(i);
  }
  // });
}

function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: '<your calendarId>',
    timeMin: (new Date()).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, {data}) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}