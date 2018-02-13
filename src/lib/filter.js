const { List } = require('immutable');

function parseFilter(filter) {
  const [key, stringValues] = filter.split(':');
  return {
    key,
    values: stringValues.split(','),
  };
}

function parseFilters(filters) {
  return filters
    .split(';')
    .map(parseFilter)
    .reduce((filtersObj, { key, values }) =>
      Object.assign({ [key]: values }, filtersObj)
    );
}

function parseFilterQuery(query) {
  return Object.assign(query, {
    filter: parseFilters(query.filter),
  });
}

function getFilterFn(filtersDef, prefix) {
  return filter => {
    const { key, values } = parseFilter(filter);
    const filterKey = prefix ? key.replace(`${prefix}.`, '') : key;
    const filterDef = filtersDef.find(({ id }) => id === filterKey);
    return item => {
      const itemValue = item.getIn(key);
      if (!item.hasIn(key) || !itemValue) {
        return false;
      }
      if (filterDef.fullText) {
        return values.findIndex(val => itemValue.includes(val)) !== -1;
      }
      if (List.isList(itemValue)) {
        return values.reduce((bool, v) => bool || itemValue.includes(v), false);
      }
      return values.indexOf(itemValue) !== -1;
    };
  };
}

function getFilterItem(queryFilter, filtersDef, prefix) {
  const filters = queryFilter.split(';');
  const filtersFn = filters.map(getFilterFn(filtersDef, prefix));
  return item => filtersFn.reduce((bool, fn) => bool && fn(item), true);
}

module.exports = { parseFilterQuery, getFilterItem };
