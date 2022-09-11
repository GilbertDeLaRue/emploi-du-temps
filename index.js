var cron = require('node-cron');
var express = require('express');
var app = express();
const axios = require("axios");
const cheerio = require("cheerio");
var convert = require('xml-js');
fs = require('fs');
const ics = require('ics')
// URL of the page we want to scrape
const url = "http://chronos.iut-velizy.uvsq.fr/EDT/g536.xml";

// Async function which scrapes the data
async function scrapeData() {
  try {
    // Fetch HTML of the page we want to scrape
    const {data}  = await axios.get(url);
    //console.log($.html())
    let result = convert.xml2json(data, {compact: true, spaces: 4});
    let obj = JSON.parse(result)


    let weeks = obj.timetable.span
    let agenda = []
    weeks.forEach(week => {
        let daysList = []
        let days = week.day
        let dateFormat = week._attributes.date
        let dd = dateFormat.substring(0,2)
        let mm = dateFormat.substring(3,5)
        let yyyy = dateFormat.substring(6,10)
        days.forEach(day => {
            let firstDate = new Date(yyyy, mm, dd)
            firstDate.setDate(firstDate.getDate()+parseInt(day._attributes.id))
            firstDate.setMonth(firstDate.getMonth()-1)
            daysList.push({
                id: day._attributes.id,
                name: day.name._text,
                date: firstDate,
                event: []
            })
        });
        agenda.push({
            id: week._attributes.id,
            alleventweeks: week.alleventweeks._text,
            title: week._attributes.date,
            date : week.description._text,
            days: daysList
        })
    });
    let events = obj.timetable.event
    events.forEach(event => {
        agenda.forEach(weeks => {
            if(event.rawweeks._text == weeks.alleventweeks){
                days = weeks.days
                days.forEach(day => {
                    if(event.day._text == day.id){
                        let modules = []
                        let staffs = []
                        try {
                            let module = event.resources.module.item
                            module.forEach(e => {
                                let element = e._text
                                modules.push(element)
                            });
                            let staff = event.resources.staff.item
                            staff.forEach(e => {
                                let element = e._text
                                staffs.push(element)
                            });
                        } catch {
                            modules.push(event.resources.module.item._text)
                            staffs.push(event.resources.staff.item._text)
                        }


                        day.event.push({
                            attributes: {
                                id: event._attributes.id,
                                timesort: event._attributes.timesort,
                                color: event._attributes.colour
                            },
                            content: {
                                group: event.resources.group.item._text,
                                module: modules,
                                staff: staffs,
                                room: event.resources.room.item._text
                            },
                            starttime: event.starttime._text,
                            endtime: event.endtime._text,
                            prettytimes: event.prettytimes._text

                        })
                    }
                });
            }
        });
    });
    let ical = []
    agenda.forEach(e => {
        let days = e.days
        days.forEach(day => {
            date = new Date(day.date)
            let events = day.event
            events.forEach(event => {
                let startHour = parseInt(event.starttime.substring(0,2))
                let startMinute = parseInt(event.starttime.substring(3,5))

                let endHour =  parseInt(event.endtime.substring(0,2))
                let endMinute = parseInt(event.endtime.substring(3,5))
                let module = event.content.module
                let modules = ''
                module.forEach(e => {
                    modules += ' '+e
                });
                let staff = event.content.staff
                let staffs = ''
                staff.forEach(e => {
                    staffs += ' '+e
                });
                ical.push({
                    start: [date.getFullYear(), date.getMonth()+1, date.getDate(), startHour, startMinute],
                    end: [date.getFullYear(), date.getMonth()+1, date.getDate(), endHour, endMinute],
                    title: modules,
                    description: staffs,
                    location: event.content.room,
                    organizer: {name: staffs}
                })

                //console.log(event)
            });
        });

    });
    const { error, value } = ics.createEvents(ical)
    if (error) {
      console.log(error)
      return
    }
    
    fs.writeFile(__dirname + '/public/edt.ics', value, function (err) {
      if (err) return console.log(err);
      console.log('saved !');
    });
  } catch (err) {
    console.error(err);
  }
}
setInterval(scrapeData, 60*60*1000);
// Invoke the above function
scrapeData();



app.get('/edt.ics', function (req, res) {
    res.sendFile(__dirname + '/public/edt.ics');
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000.');
});
