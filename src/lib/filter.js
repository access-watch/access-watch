const { List } = require('immutable');

function parseFilter(filter) {
  const [key] = filter.split(':');
  const negative = key[0] === '-';
  const values = filter.slice(key.length + 1);
  const parsedFilter = {
    key: negative ? key.slice(1) : key,
    negative,
    exists: values.length === 0,
  };
  if (!parsedFilter.exists) {
    parsedFilter.values = values.split(',');
  }
  return parsedFilter;
}

function parseFilters(filters) {
  return (
    filters &&
    filters
      .split(';')
      .map(parseFilter)
      .reduce(
        (filtersObj, filter) =>
          Object.assign({ [filter.key]: filter }, filtersObj),
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
  return ({ key, values, negative, exists }) => {
    const filterKey = prefix ? key.replace(`${prefix}.`, '') : key;
    const filterDef = filtersDef.find(({ id }) => id === filterKey) || {};
    const keyPath = key.split('.');
    const filterFn = item => {
      const itemValue = toLowerCaseIfString(item.getIn(keyPath));
      if (!item.hasIn(keyPath) || !itemValue) {
        return false;
      }
      if (exists) {
        return true;
      }
      const loweredCaseValues = values.map(toLowerCaseIfString);
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
    return negative ? item => !filterFn(item) : filterFn;
  };
}

function getFiltersFn(filters, filtersDef, prefix) {
  if (!filters) {
    return () => true;
  }
  const filtersFn = Object.keys(filters).map(key =>
    getFilterFn(filtersDef, prefix)(
      filters[key].values
        ? Object.assign({}, filters[key], {
            values: filters[key].values.map(v => {
              const filterKey = prefix ? key.replace(`${prefix}.`, '') : key;
              const { transform = a => a } =
                filtersDef.find(f => f.id === filterKey) || {};
              return transform(v);
            }),
          })
        : filters[key]
    )
  );
  return item => filtersFn.reduce((bool, fn) => bool && fn(item), true);
}

function getFiltersFnFromString(filters, filtersDef, prefix) {
  return getFiltersFn(parseFilters(filters), filtersDef, prefix);
}

module.exports = { parseFilterQuery, getFiltersFn, getFiltersFnFromString };
