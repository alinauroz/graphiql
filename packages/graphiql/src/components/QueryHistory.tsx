/**
 *  Copyright (c) 2019 GraphQL Contributors.
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import { parse } from 'graphql';
import React from 'react';
import QueryStore, { QueryStoreItem } from '../utility/QueryStore';
import HistoryQuery, {
  HandleEditLabelFn,
  HandleToggleFavoriteFn,
  HandleSelectQueryFn,
} from './HistoryQuery';

import StorageAPI from '../utility/StorageAPI';

const historyVars = new StorageAPI();

let MAX_HISTORY_LENGTH: number = 2;

alert(historyVars.get('max_history_length'));

if (historyVars.get('max_history_length')) {
  MAX_HISTORY_LENGTH = Number(historyVars.get('max_history_length'));
}

const MAX_QUERY_SIZE = 100000;

const shouldSaveQuery = (
  query?: string,
  variables?: string,
  lastQuerySaved?: QueryStoreItem,
) => {
  if (!query) {
    return false;
  }

  try {
    parse(query);
  } catch (e) {
    return false;
  }

  // Don't try to save giant queries
  if (query.length > MAX_QUERY_SIZE) {
    return false;
  }
  if (!lastQuerySaved) {
    return true;
  }
  if (JSON.stringify(query) === JSON.stringify(lastQuerySaved.query)) {
    if (
      JSON.stringify(variables) === JSON.stringify(lastQuerySaved.variables)
    ) {
      return false;
    }
    if (variables && !lastQuerySaved.variables) {
      return false;
    }
  }
  return true;
};

type QueryHistoryProps = {
  query?: string;
  variables?: string;
  operationName?: string;
  queryID?: number;
  onSelectQuery: HandleSelectQueryFn;
  storage: StorageAPI;
};

type QueryHistoryState = {
  queries: Array<QueryStoreItem>;
  historyLength: number;
};

const changeHistoryLength = (newLength: number) => {
  historyVars.set('max_history_length', String(newLength));
  MAX_HISTORY_LENGTH = newLength;
  location.reload();
  // alert(`History Size Changed to ${newLength}`);
};

export class QueryHistory extends React.Component<
  QueryHistoryProps,
  QueryHistoryState
> {
  historyStore: QueryStore;
  favoriteStore: QueryStore;

  constructor(props: QueryHistoryProps) {
    super(props);
    this.historyStore = new QueryStore(
      'queries',
      props.storage,
      MAX_HISTORY_LENGTH,
    );
    // favorites are not automatically deleted, so there's no need for a max length
    this.favoriteStore = new QueryStore('favorites', props.storage, null);
    const historyQueries = this.historyStore.fetchAll();
    const favoriteQueries = this.favoriteStore.fetchAll();
    const queries = historyQueries.concat(favoriteQueries);
    this.state = {
      queries,
      historyLength: MAX_HISTORY_LENGTH,
    };
  }

  handleOnHistoryLengthFieldChange = (e: any) => {
    this.setState({ historyLength: e.target.value });
  };

  render() {
    const queries = this.state.queries.slice().reverse();
    const queryNodes = queries.map((query, i) => {
      return (
        <HistoryQuery
          handleEditLabel={this.editLabel}
          handleToggleFavorite={this.toggleFavorite}
          key={`${i}:${query.label || query.query}`}
          onSelect={this.props.onSelectQuery}
          {...query}
        />
      );
    });

    const label_ = 'Set History Length';

    return (
      <section aria-label="History">
        <div className="history-title-bar">
          <div className="history-title">{'History'}</div>
          <div className="doc-explorer-rhs">{this.props.children}</div>
        </div>
        <div className="history-setting-bar">
          <label className="history-setting-label">{label_}</label>
          <input
            type="number"
            placeholder="Max Length"
            className="history-setting-field"
            onChange={this.handleOnHistoryLengthFieldChange}
            readOnly={false}
          />
          <input
            type="button"
            value="Set"
            className="history-setting-button"
            onClick={() => changeHistoryLength(this.state.historyLength)}
          />
        </div>
        <ul className="history-contents">{queryNodes}</ul>
      </section>
    );
  }

  // Public API
  updateHistory = (
    query?: string,
    variables?: string,
    operationName?: string,
  ) => {
    if (shouldSaveQuery(query, variables, this.historyStore.fetchRecent())) {
      this.historyStore.push({
        query,
        variables,
        operationName,
      });
      const historyQueries = this.historyStore.items;
      const favoriteQueries = this.favoriteStore.items;
      const queries = historyQueries.concat(favoriteQueries);
      this.setState({
        queries,
      });
    }
  };

  // Public API
  toggleFavorite: HandleToggleFavoriteFn = (
    query,
    variables,
    operationName,
    label,
    favorite,
  ) => {
    const item: QueryStoreItem = {
      query,
      variables,
      operationName,
      label,
    };
    if (!this.favoriteStore.contains(item)) {
      item.favorite = true;
      this.favoriteStore.push(item);
    } else if (favorite) {
      item.favorite = false;
      this.favoriteStore.delete(item);
    }
    this.setState({
      queries: [...this.historyStore.items, ...this.favoriteStore.items],
    });
  };

  // Public API
  editLabel: HandleEditLabelFn = (
    query,
    variables,
    operationName,
    label,
    favorite,
  ) => {
    const item = {
      query,
      variables,
      operationName,
      label,
    };
    if (favorite) {
      this.favoriteStore.edit({ ...item, favorite });
    } else {
      this.historyStore.edit(item);
    }
    this.setState({
      queries: [...this.historyStore.items, ...this.favoriteStore.items],
    });
  };
}
