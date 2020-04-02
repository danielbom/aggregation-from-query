# Aggregation from query

Create aggregations to use in mongoose with query params, based in query parser of json-server

# Basic usage

```javascript
const mongoose = require("mongoose");
const processQuery = require("aggregation-from-query");

const BookSchema = new mongoose.Schema({
  title: String,
  publishDate: Date,
  price: Number,
  categories: [String]
});
const Book = mongoose.model("Book", BookSchema);

processQuery(Book.schema, {
  publishDate_gte: "2020-03-01",
  publishDate_lte: "2020-07-01",
  title_regexi: "story",
  price_lt: 100,
  _sort: "price",
  _order: "1",
  _select: "title",
  _limit: 10
})
/*
[
  {
    $match: {
      title: {
        $regex: "story",
        $options: "i"
      }
    }
  },
  {
    $match: {
      publishDate: {
        $gte: "2020-03-01T00:00:00.000Z"
      }
    }
  },
  {
    $match: {
      publishDate: {
        $lte: "2020-07-01T00:00:00.000Z"
      }
    }
  },
  {
    $match: {
      price: {
        $lt: 100
      }
    }
  },
  {
    $sort: {
      price: 1
    }
  },
  {
    $limit: 10
  },
  {
    $project: {
      title: 1
    }
  }
];
*/

```

## Params support

- Less then
  - {attribute}_lt
- Less or equal then
  - {attribute}_lte
- Granter then
  - {attribute}_gt
- Granter or equal then
  - {attribute}_gte
- Equal 
  - {attribute}_eq
- Not equal
  - {attribute}_ne
- Array include
  - {attribute}_in
- Array not include
  - {attribute}_nin
- Regex
  - {attribute}_regex
- Regex with ignore case
  - {attribute}_regexi
- Sort by (separeted by comma ',')
  - _sort
  - _order
- Limits and ranges
  - _start
  - _end
  - _page
  - _limit
- Full text search (attempt, use with caution) 
  - q
