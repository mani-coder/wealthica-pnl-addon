import { DatePicker, Divider, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import moment, { Moment } from 'moment';
import { useCallback, useMemo, useState } from 'react';
import { Flex } from 'rebass';
import useCurrency from '../hooks/useCurrency';
import { Position, Transaction } from '../types';
import { formatMoney, getSymbol } from '../utils';
import { renderSymbol } from './realized-pnl/utils';

type Props = {
  fromDate: string;
  positions: Position[];
  transactions: Transaction[];
};

type Security = {
  symbol: string;
  lastPrice: number;
  price: number;
  currency: string;
  value: number;
  currencyValue: number;
  shares: number;
  accounts: { [K: string]: number };
};

export default function TradingActivities(props: Props) {
  console.log('mani is cool', props.transactions);
  const [fromDate, setFromDate] = useState<Moment>(moment(props.fromDate).startOf('D'));
  const { baseCurrencyDisplay, allCurrencies } = useCurrency();
  const symbolPriceCache = useMemo(() => {
    return props.positions.reduce((hash, position) => {
      hash[getSymbol(position.security)] = position.security.last_price;
      return hash;
    }, {});
  }, [props.positions]);

  const columns = useMemo(() => {
    const columns: ColumnsType<Security> = [
      {
        key: 'symbol',
        title: 'Symbol',
        dataIndex: 'symbol',
        render: (symbol, security) => renderSymbol(symbol),
        width: 125,
        sorter: (a, b) => a.symbol.localeCompare(b.symbol),
      },
      {
        key: 'currency',
        title: 'Currency',
        dataIndex: 'currency',
        filters: allCurrencies.map((value) => ({ text: value.toUpperCase(), value: value.toLocaleLowerCase() })),
        onFilter: (value, security) => security.currency === value,
        render: (text, security) => security.currency.toLocaleUpperCase(),
        sorter: (a, b) => a.currency.localeCompare(b.currency),
        width: 125,
      },
      {
        key: 'lastPrice',
        title: 'Last Price',
        dataIndex: 'lastPrice',
        render: (value) => formatMoney(value),
      },
      {
        key: 'price',
        title: 'Price',
        dataIndex: 'price',
        render: (value) => <Typography.Text strong>{formatMoney(value)}</Typography.Text>,
      },
      {
        key: 'shares',
        title: 'Shares',
        dataIndex: 'shares',
        render: (value) => <Typography.Text strong>{value}</Typography.Text>,
      },
      {
        key: 'value',
        title: `Amount (${baseCurrencyDisplay})`,
        dataIndex: 'value',
        render: (value) => formatMoney(value),
        defaultSortOrder: 'descend',
        sorter: (a, b) => a.value - b.value,
        width: 175,
        align: 'right',
      },
      {
        key: 'pnl',
        title: 'Change %',
        render: (value, security) => {
          const change = security.lastPrice - security.price;
          return security.lastPrice ? (
            <Typography.Text strong style={{ color: change > 0 ? 'green' : 'red', fontSize: 14 }}>
              {formatMoney((change / security.lastPrice) * 100, 2)}%
            </Typography.Text>
          ) : (
            '-'
          );
        },
        align: 'right',
        width: 125,
      },
    ];
    return columns;
  }, [baseCurrencyDisplay, allCurrencies]);

  const getSecurities = useCallback(
    (type: 'buy' | 'sell') => {
      const securitiesCache = props.transactions
        .filter((transaction) => transaction.date.isSameOrAfter(fromDate) && transaction.originalType === type)
        .reduce((hash, transaction) => {
          const symbol = transaction.symbol;
          if (!hash[symbol]) {
            hash[symbol] = {
              symbol,
              lastPrice: symbolPriceCache[symbol],
              price: transaction.currencyAmount / transaction.shares,
              currency: transaction.currency,
              value: transaction.amount,
              currencyValue: transaction.currencyAmount,
              shares: transaction.shares,
              accounts: { [transaction.account]: transaction.shares },
            };
            return hash;
          }

          const security = hash[symbol];
          security.shares = security.shares + transaction.shares;
          security.currencyValue = security.currencyValue + transaction.currencyAmount;
          security.value = security.value + transaction.amount;

          if (!security.accounts[transaction.account]) {
            security.accounts[transaction.account] = 0;
          }
          security.accounts[transaction.account] += transaction.shares;
          security.price = security.currencyValue / security.shares;

          return hash;
        }, {} as { [K: string]: Security });

      return Object.values(securitiesCache)
        .map((security) => ({ ...security, shares: Math.abs(security.shares), price: Math.abs(security.price) }))
        .sort((a, b) => b.value - a.value);
    },
    [symbolPriceCache, props.transactions, fromDate],
  );

  const boughtSecurities: Security[] = useMemo(() => getSecurities('buy'), [getSecurities]);
  const soldSecurities: Security[] = useMemo(() => getSecurities('sell'), [getSecurities]);

  function renderTable(title: string, securities: Security[]) {
    return (
      <Table<Security>
        rowKey="symbol"
        size="large"
        bordered
        title={() => (
          <Flex justifyContent="space-between">
            <Typography.Title level={5}>Securities {title}</Typography.Title>
            <DatePicker
              defaultValue={fromDate}
              disabledDate={(date) => date.isAfter(moment())}
              size="large"
              onChange={(date) => setFromDate(date ?? moment(props.fromDate))}
            />
          </Flex>
        )}
        pagination={false}
        scroll={{ y: 500 }}
        dataSource={securities}
        columns={columns}
      />
    );
  }

  return (
    <div className="zero-padding">
      {renderTable('Bought', boughtSecurities)}
      <Divider />
      {renderTable('Sold', soldSecurities)}
    </div>
  );
}
