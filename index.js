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
  const { _sort, _order, _sep = ',', _select } = query;

  const q = processTextSearch(query.q);

  const aggregation = [];
  const match = (condition) => aggregation.push({ $match: condition });
  const fullTextSearch = [];
  Object.keys({ _id: ObjectId(), ...model.obj }).forEach(attr => {
    const type = getType(model.obj[attr]);

    if (has(query, attr)) {
      const value = query[attr];

      if (value instanceof Array) {
        match({ [attr]: { $in: value.map(cast(type)) } });
      } else {
        match({ [attr]: cast(type)(value) });
      }
    }

    const regex = new RegExp(`^${attr}_(lte?|gte?|eq|ne|n?in|regexi?)$`);

    Object.keys(query).forEach(key => {
      if (regex.test(key)) {
        const values = flatMap([].concat(query[key]), a => a.toString().split(_sep));
        const [_, sufix] = regex.exec(key);

        if (/^nin$/.test(sufix)) {
          match({ [attr]: { $not: { $in: values.map(cast(type)) } } });
        } else if (/^in$/.test(sufix)) {
          match({ [attr]: { $in: values.map(cast(type)) } });
        } else if (/regexi?/.test(sufix)) {
          if (type !== 'string') return;
          const options = sufix === 'regexi' ? { $options: 'i' } : {};
          match({ [attr]: { $regex: values.join('|'), ...options } });
        } else {
          values.forEach((v) => match({ [attr]: { [`$${sufix}`]: cast(type)(v) } }));
        }
      }
    });

    if (type === 'string' && q)
      fullTextSearch.push({ [attr]: { $regex: q, $options: 'i' } });
  });

  if (fullTextSearch.length > 0) match({ $or: fullTextSearch });

  if (_sort) {
    const _sortSet = _sort.split(',');
    const _orderSet = (_order || '').split(',').map(Number);

    _sortSet.forEach((attr, index) => {
      aggregation.push({ $sort: { [attr]: _orderSet[index] || 1 } });
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

  return aggregation.length === 0 ? [{ $match: {} }] : aggregation;
}

module.exports = processQuery;
