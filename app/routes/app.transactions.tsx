import {
  Page,
  Layout,
  Card,
  DataTable,
  Filters,
  Button,
  ButtonGroup,
  BlockStack,
  Box,
  ChoiceList,
  Spinner,
  Text,
  Banner,
  Pagination,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { useFetcher } from "@remix-run/react";

interface Transaction {
  transaction_id: string;
  created_at: string;
  gross_amount: number;
  net_amount: number;
  fee_amount: number;
  currency_code: string;
  status: string;
  transaction_type: string;
  customer_name?: string;
  customer_email?: string;
  product_name?: string;
  product_description?: string;
}

interface TransactionsData {
  transactions: Transaction[];
  hasMore: boolean;
  totalCount?: number;
}

interface ErrorData {
  error: string;
}

type FetcherData = TransactionsData | ErrorData;

export default function TransactionsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [queryValue, setQueryValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const fetcher = useFetcher<FetcherData>();

  const handleStatusChange = useCallback(
    (value: string[]) => setSelectedStatus(value),
    [],
  );

  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    [],
  );

  const handleStatusRemove = useCallback(() => setSelectedStatus([]), []);
  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);
  const handleClearAll = useCallback(() => {
    handleStatusRemove();
    handleQueryValueRemove();
  }, [handleStatusRemove, handleQueryValueRemove]);

  const handleRefresh = useCallback(() => {
    fetcher.load(
      `/api/transactions?page=${currentPage}&pageSize=20&search=${encodeURIComponent(queryValue)}${selectedStatus.length > 0 ? `&status=${selectedStatus[0]}` : ""}`,
    );
    // Note: `fetcher` is intentionally excluded from dependencies as it changes identity
    // on every render in Remix, which would cause an infinite loop with the useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, queryValue, selectedStatus]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Pending", value: "pending" },
            { label: "Completed", value: "completed" },
            { label: "Failed", value: "failed" },
            { label: "Refunded", value: "refunded" },
            { label: "Expired", value: "expired" },
          ]}
          selected={selectedStatus}
          onChange={handleStatusChange}
        />
      ),
      shortcut: true,
    },
  ];

  // Transform transactions data for DataTable
  const rows =
    fetcher.data && "transactions" in fetcher.data
      ? fetcher.data.transactions.map((tx: Transaction) => [
        tx.transaction_id.substring(0, 8) + "...", // Shortened ID
        new Date(tx.created_at).toLocaleDateString(),
        tx.customer_name || tx.customer_email || "Anonymous",
        `${tx.gross_amount.toLocaleString()} ${tx.currency_code}`,
        `${tx.net_amount.toLocaleString()} ${tx.currency_code}`,
        tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
      ])
      : [];

  // Show loading state
  if (fetcher.state === "loading" && !fetcher.data) {
    return (
      <Page fullWidth>
        <ui-title-bar title="Transactions" />
        <Layout>
          <Layout.Section>
            <Card roundedAbove="sm">
              <Box padding="400">
                <BlockStack gap="400" inlineAlign="center">
                  <Spinner size="large" />
                  <Text variant="bodyMd" as="p">
                    Loading transactions...
                  </Text>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Show error state
  if (fetcher.data && "error" in fetcher.data) {
    return (
      <Page fullWidth>
        <ui-title-bar title="Transactions" />
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <Text variant="bodyMd" as="p">
                {fetcher.data.error}
              </Text>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page fullWidth>
      <ui-title-bar title="Transactions" />
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="500">
              <Box padding="400">
                <Filters
                  queryValue={queryValue}
                  filters={filters}
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={handleQueryValueRemove}
                  onClearAll={handleClearAll}
                />
              </Box>

              {rows.length === 0 ? (
                <Box padding="400">
                  <BlockStack gap="400" inlineAlign="center">
                    <Text variant="bodyMd" as="p">
                      No transactions found
                    </Text>
                    {queryValue || selectedStatus.length > 0 ? (
                      <Button onClick={handleClearAll} variant="plain">
                        Clear filters
                      </Button>
                    ) : null}
                  </BlockStack>
                </Box>
              ) : (
                <>
                  <Box padding="400">
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "text",
                        "numeric",
                        "numeric",
                        "text",
                      ]}
                      headings={[
                        "Transaction ID",
                        "Date",
                        "Customer",
                        "Gross",
                        "Net",
                        "Status",
                      ]}
                      rows={rows}
                    />
                  </Box>

                  {fetcher.data &&
                    "totalCount" in fetcher.data &&
                    fetcher.data.totalCount &&
                    fetcher.data.totalCount > 20 && (
                      <Box padding="400">
                        <Pagination
                          hasPrevious={currentPage > 1}
                          hasNext={fetcher.data.hasMore}
                          onPrevious={() => handlePageChange(currentPage - 1)}
                          onNext={() => handlePageChange(currentPage + 1)}
                          label={`Page ${currentPage}`}
                        />
                      </Box>
                    )}
                </>
              )}

              <Box padding="400">
                <ButtonGroup>
                  <Button disabled>Export</Button>
                  <Button
                    variant="primary"
                    onClick={handleRefresh}
                    loading={fetcher.state === "loading"}
                  >
                    Refresh
                  </Button>
                </ButtonGroup>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
