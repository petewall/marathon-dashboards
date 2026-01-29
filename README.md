# Marathon Dashboards

This repository contains a collection of Grafana Dashboards that visualize data
based on the Marathon Stats plugins in Aleph One.

## Structure

The dashboards are distributed in this structure:

```text
Marathon Stats/
  Summary
  Marathon 1
  Marathon 1 Levels/
    1 - Arrival
    ...
  Marathon 2
  Marathon 2 Levels/
    ...
  Marathon Infinity
  Marathon Infinity Levels/
    ...
```

### Summary Dashboard

This dashboard rolls up the stats from all games:

* Lists the games with logos and release dates
* Shows time spent playing each game
* Shows the % completed (how many levels have "level completed" / number of levels)

### Game Dashboard

This dashboard shows the stats from an individual game

* Shows the game data with logo and release date
* Shows time spent playing the game
* Shows the % completed (how many levels have "level completed" / number of levels)
* Lists the levels as a table and shows:
  * Time spend playing that level
  * Times completed that level
  * How many times died

* Lists the weapons and shows:
  * Picture
  * Name
  * Shots
  * Hits
  * Accuracy (hits / shots)

* Lists the monsters and shows:
  * Picture
  * Name
  * Kills
  * Killed by punch
  * Deaths to that monster

### Level Dashboard

This dashboard shows the stats from a level in a game

* Shows the name
* Shows the map
* (stretch) shows an "x" on the map where the player has died
* Time spend playing that level
* Times completed that level
* How many times died

* Lists the weapons and shows:
  * Picture
  * Name
  * Shots
  * Hits
  * Accuracy (hits / shots)

* Lists the monsters and shows:
  * Picture
  * Name
  * Kills
  * Killed by punch
  * Deaths to that monster

## Data source

The data is stored as JSON records in a MongoDB database. MongoDB was chosen because:

* No required data formats (unlike SQL DBs)
* No data retention limits (unlike Loki)
* OSS and easy to deploy
