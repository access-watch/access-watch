const { List } = require('immutable');

function parseFilter(filter) {
  const [key] = filter.split(':');
  return {
    key,
    values: filter.slice(key.length + 1).split(','),
  };
}

function parseFilters(filters) {
  return (
    filters &&
    filters
      .split(';')
      .map(parseFilter)
      .reduce(
        (filtersObj, { key, values }) =>
          Object.assign({ [key]: values }, filtersObj),
        {}
      )
  );
}

function parseFilterQuery(query) {
  return Object.assign({}, query, {
    filter: parseFilters(query.filter),
  });
}

function toLowerCaseIfString(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function getFilterFn(filtersDef, prefix) {
  return ({ key, values }) => {
    const filterKey = prefix ? key.replace(`${prefix}.`, '') : key;
    const filterDef = filtersDef.find(({ id }) => id === filterKey) || {};
    const keyPath = key.split('.');
    const loweredCaseValues = values.map(toLowerCaseIfString);
    return item => {
      const itemValue = toLowerCaseIfString(item.getIn(keyPath));
      if (!item.hasIn(keyPath) || !itemValue) {
        return false;
      }
      if (filterDef.fullText) {
        return (
          loweredCaseValues.findIndex(val => itemValue.includes(val)) !== -1
        );
      }
      if (List.isList(itemValue)) {
        const loweredCaseInputValue = itemValue.map(toLowerCaseIfString);
        return loweredCaseValues.reduce(
          (bool, v) => bool || loweredCaseInputValue.includes(v),
          false
        );
      }
      return loweredCaseValues.indexOf(itemValue) !== -1;
    };
  };
}

function getFiltersFn(filters, filtersDef, prefix) {
  if (!filters) {
    return () => true;
  }
  const filtersFn = Object.keys(filters).map(key =>
    getFilterFn(filtersDef, prefix)({
      key,
      values: filters[key].map(v => {
        const filterKey = prefix ? key.replace(`${prefix}.`, '') : key;
        const { transform = a => a } =
          filtersDef.find(f => f.id === filterKey) || {};
        return transform(v);
      }),
    })
  );
  return item => filtersFn.reduce((bool, fn) => bool && fn(item), true);
}

function getFiltersFnFromString(filters, filtersDef, prefix) {
  return getFiltersFn(parseFilters(filters), filtersDef, prefix);
}

module.exports = { parseFilterQuery, getFiltersFn, getFiltersFnFromString };
