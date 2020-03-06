# Aggregation from query

Create aggregations to use in mongoose with query params, based in query parser of json-server

# Basic usage

```javascript
const MyModel = require("path/to/model/MyModel");
const processQuery = require("aggregation-from-query");

async function index(req, res) {
  try {
    const aggregation = processQuery(MyModel.schema, req.query);

    const entities = await MyModel.aggregate(aggregation);

    return res.status(200).json(entities);
  } catch (e) {
    return res.status(500).json({
      error: e.toString(),
      message: e.message,
      stack: e.stack
    });
  }
}
```
