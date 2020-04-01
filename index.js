const { Types } = require('mongoose');
const { ObjectId } = Types;

const has = (obj, key) => obj.hasOwnProperty(key);
const getType = attrModel => {
  return !attrModel ? ''
    : has(attrModel, 'type') ? getType(attrModel.type)
    : typeof attrModel === 'string' ? attrModel.toLowerCase()
    : typeof attrModel === 'function' ? attrModel.name.toLowerCase()
    : attrModel instanceof Array && getType(attrModel[0]);
};
const cast = type => value => {
  switch (type) {
    case 'string':
      return value.toString();
    case 'bigint':
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'date':
      return new Date(value);
    case 'objectid':
      return new ObjectId(value);
    case 'array':
      return cast(type[0]);
    default:
      return value;
  }
};
const flatMap = (array, fn) => {
  return array.reduce((arr, e) => {
    arr.push(...fn(e));
    return arr;
  }, []);
};
const processTextSearch = arrayOrString => {
  if (!arrayOrString) return arrayOrString;
  if (arrayOrString instanceof Array)
    return processTextSearch(arrayOrString[0]);

  const text = arrayOrString;

  return text;
};

function processQuery(model, query) {
  let { _start, _end, _page, _limit } = query;
  const { _sort, _order, _sep, _select } = query;

  const q = processTextSearch(query.q);

  const aggregation = [];
  const fullTextSearch = [];
  Object.keys(model.obj).forEach(attr => {
    const type = getType(model.obj[attr]);

    if (has(query, attr)) {
      const value = query[attr];

      if (value instanceof Array) {
        aggregation.push({
          $match: {
            [attr]: {
              $in: value.map(cast(type))
            }
          }
        });
      } else {
        aggregation.push({
          $match: {
            [attr]: cast(type)(value)
          }
        });
      }
    }

    const regex = new RegExp(`${attr}_(lte?|gte?|eq|ne|n?in|regexi?)$`);

    Object.keys(query).forEach(key => {
      let values = [].concat(query[key]);
      values = _sep ? flatMap(values, a => a.split(_sep)) : values;

      if (regex.test(key)) {
        const [_, sufix] = regex.exec(key);

        if (sufix.match(/n?in/)) {
          aggregation.push({
            $match: {
              [attr]: {
                [`$${sufix}`]: values.map(cast(type))
              }
            }
          });
        } else if (sufix === 'regexi') {
          values.forEach(value => {
            aggregation.push({
              $match: {
                [attr]: { $regex: value, $options: 'i' }
              }
            });
          });
        } else {
          values.forEach(value => {
            aggregation.push({
              $match: {
                [attr]: {
                  [`$${sufix}`]: sufix === 'regex' ? value : cast(type)(value)
                }
              }
            });
          });
        }
      }
    });

    if (type === 'string' && q)
      fullTextSearch.push({ [attr]: { $regex: q, $options: 'i' } });
  });

  if (fullTextSearch.length > 0)
    aggregation.push({ $match: { $or: fullTextSearch } });

  if (_sort) {
    const _sortSet = _sort.split(',');
    const _orderSet = (_order || '').split(',').map(Number);

    _sortSet.forEach((attr, index) => {
      aggregation.push({
        $sort: {
          [attr]: _orderSet[index] || 1
        }
      });
    });
  }

  if (_select) {
    const included = !_select.match(/^-/);
    const select = !included ? _select.replace('-', '') : _select;
    const selectSet = select.split(',');
    const signal = included ? 1 : 0;

    aggregation.push({
      $project: selectSet.reduce((obj, field) => {
        obj[field] = signal;
        return obj;
      }, {})
    });
  }

  if (_end) {
    _start = parseInt(_start, 10) || 0;
    _end = parseInt(_end, 10) || 0;
    _limit = _end - _start;

    aggregation.push({ $skip: _start });
  } else if (_page) {
    _page = parseInt(_page, 10) || 0;
    _limit = parseInt(_limit, 10) || 10;

    aggregation.push({ $skip: _page * _limit });
  } else if (_start) {
    _start = parseInt(_start, 10) || 0;

    aggregation.push({ $skip: _start });
  }

  if (_limit) {
    _limit = parseInt(_limit, 10) || 10;

    aggregation.push({ $limit: _limit });
  }

  return aggregation;
}

module.exports = processQuery;
